import sys
import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from PIL import Image

def generate_saros_exeligmos_plot(saros_num=136, output_paths=None):
    base_dir = r'c:\Users\diego\cosmosmataro-elsol'
    csv_path = os.path.join(base_dir, 'eclipse_besselian_elements.csv')
    
    df = pd.read_csv(csv_path)
    saros_df = df[df['saros'] == saros_num].copy().sort_values(by=['year', 'month', 'day']).reset_index(drop=True)
    
    if len(saros_df) == 0:
        print(f"Error: No data found for Saros {saros_num}")
        return
    
    saros_df['seq'] = range(1, len(saros_df) + 1)
    saros_df['branch'] = ((saros_df['seq'] - 1) % 3) + 1
    saros_df['exeligmos_idx'] = (saros_df['seq'] - 1) // 3 + 1
    
    # Setup styling
    plt.style.use('dark_background')
    fig = plt.figure(figsize=(20, 14), dpi=220)
    fig.patch.set_facecolor('#070a12')
    
    # 2x2 layout with custom grid
    gs = fig.add_gridspec(2, 2, height_ratios=[1.3, 0.9], hspace=0.28, wspace=0.20)
    
    ax_map = fig.add_subplot(gs[0, :])
    ax_lon_yr = fig.add_subplot(gs[1, 0])
    ax_lat_yr = fig.add_subplot(gs[1, 1])
    
    branch_colors = {
        1: '#00e5ff',  # Neon Cyan
        2: '#ff3366',  # Neon Coral / Pink-Red
        3: '#ffc107'   # Bright Gold / Amber
    }
    
    branch_names = {
        1: f"Rama 1 (Eclipses #1, 4, 7... | {saros_df[saros_df['branch']==1]['year'].min()} a {saros_df[saros_df['branch']==1]['year'].max()} | {len(saros_df[saros_df['branch']==1])} eclipses)",
        2: f"Rama 2 (Eclipses #2, 5, 8... | {saros_df[saros_df['branch']==2]['year'].min()} a {saros_df[saros_df['branch']==2]['year'].max()} | {len(saros_df[saros_df['branch']==2])} eclipses)",
        3: f"Rama 3 (Eclipses #3, 6, 9... | {saros_df[saros_df['branch']==3]['year'].min()} a {saros_df[saros_df['branch']==3]['year'].max()} | {len(saros_df[saros_df['branch']==3])} eclipses)"
    }
    
    # ----------------------------------------------------
    # PANEL 1: WORLD MAP WITH EXELIGMOS TRACKS
    # ----------------------------------------------------
    earth_img_path = os.path.join(base_dir, 'earth_topo_2048.jpg')
    if os.path.exists(earth_img_path):
        earth_img = Image.open(earth_img_path)
        earth_arr = np.array(earth_img).astype(float) * 0.42
        earth_arr = earth_arr.astype(np.uint8)
        ax_map.imshow(earth_arr, extent=[-180, 180, -90, 90], aspect='auto', origin='upper')
    else:
        ax_map.set_facecolor('#0d1424')
        
    ax_map.set_xlim(-180, 180)
    ax_map.set_ylim(-90, 90)
    ax_map.grid(True, linestyle=':', color='#334155', alpha=0.55)
    ax_map.set_xticks(np.arange(-180, 181, 30))
    ax_map.set_yticks(np.arange(-90, 91, 30))
    ax_map.set_xticklabels([f"{abs(x)}°O" if x < 0 else (f"{x}°E" if x > 0 else "0°") for x in np.arange(-180, 181, 30)], fontsize=9, color='#94a3b8')
    ax_map.set_yticklabels([f"{abs(y)}°S" if y < 0 else (f"{y}°N" if y > 0 else "0°") for y in np.arange(-90, 91, 30)], fontsize=9, color='#94a3b8')
    ax_map.set_title(f"DISTRIBUCION GEOGRAFICA DE LOS EXELIGMOS - SAROS SOLAR {saros_num} ({saros_df['year'].min()} a {saros_df['year'].max()} d.C.)", fontsize=14, fontweight='bold', color='#f8fafc', pad=14)
    ax_map.set_xlabel("Longitud Geografica del Eclipse Maximo", fontsize=11, color='#cbd5e1', labelpad=6)
    ax_map.set_ylabel("Latitud Geografica", fontsize=11, color='#cbd5e1', labelpad=6)
    
    # Plot each branch on the map
    for b in [1, 2, 3]:
        b_data = saros_df[saros_df['branch'] == b].copy()
        color = branch_colors[b]
        
        lons = b_data['lng_dd_ge'].values
        lats = b_data['lat_dd_ge'].values
        
        # Segments for plotting lines without dateline streak
        seg_lons = [lons[0]]
        seg_lats = [lats[0]]
        for i in range(1, len(lons)):
            if abs(lons[i] - lons[i-1]) > 180:
                ax_map.plot(seg_lons, seg_lats, color=color, alpha=0.6, linewidth=2.0, linestyle='--')
                seg_lons = [lons[i]]
                seg_lats = [lats[i]]
            else:
                seg_lons.append(lons[i])
                seg_lats.append(lats[i])
        if len(seg_lons) > 1:
            ax_map.plot(seg_lons, seg_lats, color=color, alpha=0.6, linewidth=2.0, linestyle='--', label=branch_names[b])
            
        # Draw points
        for _, row in b_data.iterrows():
            if row['eclipse_type'] in ['T', 'Tm']:
                ax_map.scatter(row['lng_dd_ge'], row['lat_dd_ge'], color=color, s=65, edgecolor='#ffffff', linewidth=0.9, zorder=5)
            elif row['eclipse_type'] in ['A', 'Am']:
                ax_map.scatter(row['lng_dd_ge'], row['lat_dd_ge'], color='#090d16', s=55, edgecolor=color, linewidth=2.0, marker='s', zorder=5)
            elif row['eclipse_type'] in ['H', 'Hm']:
                ax_map.scatter(row['lng_dd_ge'], row['lat_dd_ge'], color=color, s=70, edgecolor='#ffffff', linewidth=1.0, marker='^', zorder=5)
            else:
                ax_map.scatter(row['lng_dd_ge'], row['lat_dd_ge'], color=color, s=35, marker='x', linewidth=1.5, zorder=4, alpha=0.75)

    # Highlight and annotate famous eclipses for Saros 136
    famous_annotations = {
        1919: ("1919 (Sobral/Principe | Relatividad)", 12, -14),
        1955: ("1955 (Filipinas | 7m08s)", 12, -14),
        1973: ("1973 (Sahara | Concorde 74m)", 12, 12),
        1991: ("1991 (Hawai/Mexico | 6m53s)", -145, -14),
        2009: ("2009 (China/Pacifico | 6m39s)", 12, -14),
        2027: ("2027 (Tarifa/Egipto | 6m22s)", 12, 14),
        2045: ("2045 (EE.UU. costa a costa | 6m06s)", -145, 12),
        2081: ("2081 (Europa Central / Espana)", 12, -14),
    }
    for _, row in saros_df.iterrows():
        yr = row['year']
        if yr in famous_annotations:
            text, dx, dy = famous_annotations[yr]
            b_color = branch_colors[row['branch']]
            ax_map.annotate(
                f"{text}",
                xy=(row['lng_dd_ge'], row['lat_dd_ge']),
                xytext=(row['lng_dd_ge'] + dx, row['lat_dd_ge'] + dy),
                arrowprops=dict(arrowstyle="->", color=b_color, lw=1.3, shrinkB=4),
                fontsize=8.5, fontweight='bold', color='#ffffff',
                bbox=dict(boxstyle="round,pad=0.3", fc='#090d16', ec=b_color, alpha=0.92, lw=1.2),
                zorder=10
            )

    ax_map.legend(loc='lower left', framealpha=0.9, facecolor='#090d16', edgecolor='#334155', fontsize=9.5)

    # ----------------------------------------------------
    # PANEL 2: LONGITUDE VS YEAR / SEQUENCE
    # ----------------------------------------------------
    ax_lon_yr.set_facecolor('#0a0f1d')
    ax_lon_yr.grid(True, linestyle=':', color='#334155', alpha=0.5)
    
    # Plot all Saros connections in faint grey (showing the 120 deg jumps)
    ax_lon_yr.plot(saros_df['year'], saros_df['lng_dd_ge'], color='#475569', linestyle=':', alpha=0.45, linewidth=1.0, label='Paso Saros (salto de ~120 deg O)')
    
    for b in [1, 2, 3]:
        b_data = saros_df[saros_df['branch'] == b]
        color = branch_colors[b]
        ax_lon_yr.plot(b_data['year'], b_data['lng_dd_ge'], color=color, linewidth=2.4, marker='o', markersize=5, label=f"Rama Exeligmo {b}", alpha=0.95)
        
    ax_lon_yr.set_title("Evolucion Longitudinal por Rama (3 Saros = 54.1 anos)", fontsize=12, fontweight='bold', color='#f8fafc', pad=10)
    ax_lon_yr.set_xlabel("Ano del Eclipse (d.C.)", fontsize=10, color='#cbd5e1')
    ax_lon_yr.set_ylabel("Longitud Geografica (deg)", fontsize=10, color='#cbd5e1')
    ax_lon_yr.set_ylim(-185, 185)
    ax_lon_yr.set_yticks(np.arange(-180, 181, 60))
    ax_lon_yr.set_yticklabels([f"{abs(x)}°O" if x < 0 else (f"{x}°E" if x > 0 else "0°") for x in np.arange(-180, 181, 60)], fontsize=8.5, color='#94a3b8')
    ax_lon_yr.legend(loc='upper right', framealpha=0.88, facecolor='#090d16', edgecolor='#334155', fontsize=8.5)
    
    ax_lon_yr.text(0.03, 0.06, "Cada Exeligmo compensa las ~8h de la rotacion terrestre (3 x 120 deg = 360 deg).\nCada rama permanece en una franja longitudinal casi constante con suave deriva.", 
                   transform=ax_lon_yr.transAxes, fontsize=8, color='#94a3b8', style='italic',
                   bbox=dict(boxstyle="square,pad=0.4", fc='#090d16', ec='#1e293b', alpha=0.9))

    # ----------------------------------------------------
    # PANEL 3: LATITUDE VS YEAR / SEQUENCE
    # ----------------------------------------------------
    ax_lat_yr.set_facecolor('#0a0f1d')
    ax_lat_yr.grid(True, linestyle=':', color='#334155', alpha=0.5)
    
    ax_lat_yr.plot(saros_df['year'], saros_df['lat_dd_ge'], color='#64748b', linestyle='-', alpha=0.35, linewidth=1.5)
    
    for b in [1, 2, 3]:
        b_data = saros_df[saros_df['branch'] == b]
        color = branch_colors[b]
        ax_lat_yr.plot(b_data['year'], b_data['lat_dd_ge'], color=color, linewidth=2.4, marker='s', markersize=5, label=f"Rama Exeligmo {b}", alpha=0.95)
        
    ax_lat_yr.set_title("Migracion Latitudinal (Sur a Norte - Nodo Ascendente)", fontsize=12, fontweight='bold', color='#f8fafc', pad=10)
    ax_lat_yr.set_xlabel("Ano del Eclipse (d.C.)", fontsize=10, color='#cbd5e1')
    ax_lat_yr.set_ylabel("Latitud Geografica (deg)", fontsize=10, color='#cbd5e1')
    ax_lat_yr.set_ylim(-90, 90)
    ax_lat_yr.set_yticks(np.arange(-90, 91, 30))
    ax_lat_yr.set_yticklabels([f"{abs(y)}°S" if y < 0 else (f"{y}°N" if y > 0 else "0°") for y in np.arange(-90, 91, 30)], fontsize=8.5, color='#94a3b8')
    ax_lat_yr.axhline(0, color='#64748b', linestyle='--', alpha=0.5, linewidth=1.0)
    ax_lat_yr.text(saros_df['year'].min() + 15, 3, 'Ecuador (0°)', color='#64748b', fontsize=8)
    ax_lat_yr.legend(loc='lower right', framealpha=0.88, facecolor='#090d16', edgecolor='#334155', fontsize=8.5)

    for p in output_paths:
        os.makedirs(os.path.dirname(os.path.abspath(p)), exist_ok=True)
        plt.savefig(p, dpi=220, facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
        print(f"Plot saved successfully to: {p}")
        
    plt.close()

if __name__ == '__main__':
    saros = 136
    if len(sys.argv) > 1:
        saros = int(sys.argv[1])
    
    artifact_dir = r'C:\Users\diego\.gemini\antigravity\brain\a0230035-d6db-4218-b505-a6e247583d88'
    paths = [
        os.path.join(artifact_dir, f'saros{saros}_exeligmos_plot.png'),
        os.path.join(r'c:\Users\diego\cosmosmataro-elsol', f'saros{saros}_exeligmos_plot.png')
    ]
    generate_saros_exeligmos_plot(saros, paths)
