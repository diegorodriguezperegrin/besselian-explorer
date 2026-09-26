#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
audit_all_eclipses.py
======================
Auditor analítico de alta velocidad para el catálogo de 11.898 eclipses solares de la NASA (-1999 a +3000).
Ejecuta la verificación geométrica de lobes_test_engine.js en paralelo aprovechando todos los núcleos de la CPU.

Uso:
    python audit_all_eclipses.py
    python audit_all_eclipses.py --start-year 1900 --end-year 2100
    python audit_all_eclipses.py --type T --workers 8
    python audit_all_eclipses.py --saros 134

Coste de tokens: 0 (Ejecución 100% analítica local en tu procesador)
"""

import sys
import os
import time
import json
import argparse
import subprocess
import threading
import queue

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

def parse_args():
    parser = argparse.ArgumentParser(
        description="Auditoría analítica paralela de curvas y límites de eclipses solares."
    )
    parser.add_argument("--start-year", type=int, default=-1999, help="Año inicial (por defecto -1999)")
    parser.add_argument("--end-year", type=int, default=3000, help="Año final (por defecto 3000)")
    parser.add_argument("--type", type=str, default=None, choices=["T", "A", "H", "P"], help="Filtrar por tipo (T, A, H, P)")
    parser.add_argument("--saros", type=int, default=None, help="Filtrar por serie Saros específica")
    parser.add_argument("--workers", type=int, default=os.cpu_count() or 4, help="Número de hilos/procesos paralelos (por defecto todos los núcleos)")
    parser.add_argument("--jump", type=float, default=15.0, help="Umbral en grados para alertar saltos bruscos (por defecto 15.0°)")
    parser.add_argument("--gap", type=float, default=2.0, help="Umbral en grados para alertar desconexión de curvas (por defecto 2.0°)")
    parser.add_argument("--out", type=str, default="audit_report.json", help="Archivo JSON de salida con las incidencias (por defecto audit_report.json)")
    return parser.parse_args()

def get_total_eclipses(data_path):
    """Cuenta el número de registros en solar_eclipses_data.js sin cargar todo en memoria."""
    try:
        with open(data_path, 'r', encoding='utf-8') as f:
            content = f.read(5000)
            if "11,898" in content or "11898" in content:
                # El catálogo canónico tiene 11.898 registros
                return 11898
        # Conteo exacto mediante Node si fuera necesario
        cmd = ["node", "-e", "const fs=require('fs'); const s=fs.readFileSync('solar_eclipses_data.js','utf8'); eval(s); console.log(NASA_SOLAR_RAW.length);"]
        res = subprocess.check_output(cmd, cwd=os.path.dirname(data_path), text=True)
        return int(res.strip())
    except Exception:
        return 11898

def main():
    args = parse_args()
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(script_dir, "solar_eclipses_data.js")
    worker_path = os.path.join(script_dir, "audit_worker.js")

    if not os.path.exists(data_path):
        print(f"[ERROR] No se encontró {data_path}")
        sys.exit(1)
    if not os.path.exists(worker_path):
        print(f"[ERROR] No se encontró {worker_path}")
        sys.exit(1)

    total_eclipses = get_total_eclipses(data_path)
    num_workers = max(1, min(args.workers, 32))

    print("=" * 80)
    print("   AUDITORIA ANALITICA DE ECLIPSES SOLARES (NASA GSFC CANON -1999 A +3000)")
    print("   Motor analitico: lobes_test_engine.js | Ejecucion 100% local (0 tokens)")
    print("=" * 80)
    print(f" * Catalogo total:       {total_eclipses:,} eclipses")
    print(f" * Rango de anos:        {args.start_year} a {args.end_year}")
    print(f" * Filtro de tipo:       {args.type or 'Todos (T, A, H, P)'}")
    print(f" * Filtro de Saros:      {args.saros if args.saros is not None else 'Todos'}")
    print(f" * Umbral de salto:      {args.jump} deg")
    print(f" * Umbral de brecha:     {args.gap} deg")
    print(f" * Procesos paralelos:   {num_workers} nucleos")
    # Obtener la lista exacta de índices que coinciden con los filtros
    js_filter = f"""
    const fs = require('fs');
    const s = fs.readFileSync('{data_path.replace(os.sep, "/")}', 'utf8');
    const raw = (new Function(s + '; return NASA_SOLAR_RAW;'))();
    const res = [];
    for (let i = 0; i < raw.length; i++) {{
        const r = raw[i];
        const yr = r[1], tp = r[7], sr = r[6];
        if (yr >= {args.start_year} && yr <= {args.end_year}) {{
            if ('{args.type or ""}' === '' || tp === '{args.type}') {{
                if ({args.saros if args.saros is not None else "null"} === null || sr === {args.saros if args.saros is not None else 0}) {{
                    res.push(i);
                }}
            }}
        }}
    }}
    console.log(JSON.stringify(res));
    """
    try:
        raw_indices_out = subprocess.check_output(["node", "-e", js_filter], cwd=script_dir, text=True)
        matching_indices = json.loads(raw_indices_out.strip())
    except Exception as e:
        print(f"[ERROR] Error al filtrar índices: {e}")
        sys.exit(1)

    total_target = len(matching_indices)
    print(f" * Eclipses a auditar:   {total_target:,} (tras aplicar filtros)")
    print("=" * 80)

    if total_target == 0:
        print("  [AVISO] Ningún eclipse coincide con los criterios especificados.")
        sys.exit(0)

    # Dividir los índices objetivo equitativamente entre los workers disponibles
    actual_workers = min(num_workers, total_target)
    chunks = []
    chunk_size = (total_target + actual_workers - 1) // actual_workers
    for w in range(actual_workers):
        subset = matching_indices[w * chunk_size : min((w + 1) * chunk_size, total_target)]
        if subset:
            chunks.append(subset)

    results_queue = queue.Queue()
    all_anomalies = []
    processed_count = [0]
    lock = threading.Lock()
    start_time = time.time()

    def worker_thread(indices_subset):
        cmd = [
            "node", worker_path,
            "--indices", ",".join(str(x) for x in indices_subset),
            "--jump", str(args.jump),
            "--gap", str(args.gap)
        ]

        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=script_dir,
            text=True,
            bufsize=1
        )

        for line in proc.stdout:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                results_queue.put(data)
            except json.JSONDecodeError:
                pass

        proc.wait()

    threads = []
    for subset in chunks:
        t = threading.Thread(target=worker_thread, args=(subset,), daemon=True)
        t.start()
        threads.append(t)

    # Bucle de progreso
    active_workers = len(threads)
    bar_width = 30

    while active_workers > 0:
        try:
            msg = results_queue.get(timeout=0.1)
            msg_type = msg.get("type")

            if msg_type == "progress":
                with lock:
                    processed_count[0] += msg.get("count", 0)
            elif msg_type == "anomaly":
                with lock:
                    all_anomalies.append(msg)
            elif msg_type == "done":
                active_workers -= 1
        except queue.Empty:
            # Comprobar si los hilos siguen vivos
            alive = sum(1 for t in threads if t.is_alive())
            if alive == 0 and results_queue.empty():
                break

        # Render de la barra de progreso
        with lock:
            done = processed_count[0]
            anom_count = len(all_anomalies)

        pct = min(100.0, (done / total_target) * 100.0) if total_target > 0 else 100.0
        filled = int(bar_width * (pct / 100.0))
        bar = "#" * filled + "-" * (bar_width - filled)

        elapsed = time.time() - start_time
        speed = done / elapsed if elapsed > 0 else 0
        remaining_sec = (total_target - done) / speed if speed > 0 else 0

        eta_str = f"{int(remaining_sec)}s" if remaining_sec < 60 else f"{int(remaining_sec // 60)}m {int(remaining_sec % 60)}s"

        sys.stdout.write(
            f"\r [{bar}] {pct:5.1f}% | {done:5d}/{total_target} | {speed:5.1f} ecl/s | ETA: {eta_str:>6s} | Incidencias: {anom_count:2d}"
        )
        sys.stdout.flush()

    for t in threads:
        t.join()

    total_time = time.time() - start_time
    print("\n" + "=" * 80)
    print("   INFORME FINAL DE AUDITORIA ANALITICA")
    print("=" * 80)
    print(f" * Tiempo total de escaneo: {total_time:.2f} segundos")
    print(f" * Eclipses procesados:    {processed_count[0]:,}")
    print(f" * Velocidad media:        {processed_count[0] / total_time:.1f} eclipses/segundo")
    print(f" * Total incidencias:      {len(all_anomalies)}")
    print("-" * 80)

    if not all_anomalies:
        print("  [OK] RESULTADO: 100% LIMPIO. Ningun eclipse presento discontinuidades, saltos ni arcos anomalos.")
    else:
        print(f"  [ALERTA] Se han detectado {len(all_anomalies)} eclipses con anomalias geometricas:\n")
        print(f"{'FECHA':<12} {'TIPO':<6} {'SAROS':<7} {'GAMMA':<8} {'INCIDENCIAS DETECTADAS'}")
        print("-" * 80)
        for a in all_anomalies[:50]:  # Mostrar los primeros 50 en consola
            issues_str = "; ".join([iss["desc"] for iss in a["issues"]])
            gamma_val = a.get("gamma")
            gamma_str = f"{gamma_val:+.4f}" if gamma_val is not None else "  -   "
            print(f"{a['date']:<12} {a['eclipse_type']:<6} {str(a['saros']):<7} {gamma_str:<8} {issues_str}")

        if len(all_anomalies) > 50:
            print(f"\n... y {len(all_anomalies) - 50} incidencias más (ver archivo JSON completo).")

    # Guardar informe en archivo JSON
    report_data = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_catalog": total_eclipses,
        "audited_count": processed_count[0],
        "elapsed_seconds": round(total_time, 2),
        "parameters": vars(args),
        "total_anomalies": len(all_anomalies),
        "anomalies": all_anomalies
    }

    out_file = os.path.join(script_dir, args.out)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2, ensure_ascii=False)

    print("-" * 80)
    print(f" • Informe detallado guardado en: {out_file}")
    print("=" * 80 + "\n")

if __name__ == "__main__":
    main()
