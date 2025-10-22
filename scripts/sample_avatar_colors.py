#!/usr/bin/env python3

"""
Sample pixel colors from avatar PNG images at specific calibration points
and output the exact color values to use in the SVG overlays.

Usage: python3 scripts/sample_avatar_colors.py <avatar-name>
Example: python3 scripts/sample_avatar_colors.py marcus
"""

import sys
import os
import re
import json
from PIL import Image

def extract_coords(svg_content):
    """Extract coordinates from SVG elements"""
    coords = {
        'mouth': None,
        'eyelids': [],
        'pupils': [],
        'eyes': []
    }
    
    # Extract mouth ellipse coordinates
    mouth_match = re.search(r'<ellipse[^>]*id="mouthShape"[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"[^>]*rx="([^"]+)"[^>]*ry="([^"]+)"', svg_content)
    if mouth_match:
        coords['mouth'] = {
            'cx': float(mouth_match.group(1)),
            'cy': float(mouth_match.group(2)),
            'rx': float(mouth_match.group(3)),
            'ry': float(mouth_match.group(4))
        }
    
    # Extract eyelid rectangles
    lid_matches = re.finditer(r'<rect[^>]*id="(lid[^"]+)"[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*width="([^"]+)"[^>]*height="([^"]+)"', svg_content)
    for match in lid_matches:
        coords['eyelids'].append({
            'id': match.group(1),
            'x': float(match.group(2)),
            'y': float(match.group(3)),
            'width': float(match.group(4)),
            'height': float(match.group(5))
        })
    
    # Extract pupil circles
    pupil_matches = re.finditer(r'<circle[^>]*id="(pupil[LR])"[^>]*', svg_content)
    for match in pupil_matches:
        circle_tag = match.group(0)
        pupil_id = match.group(1)

        # Extract cx, cy, r from the circle tag
        cx_match = re.search(r'cx="([^"]+)"', circle_tag)
        cy_match = re.search(r'cy="([^"]+)"', circle_tag)
        r_match = re.search(r'\sr="([^"]+)"', circle_tag)

        if cx_match and cy_match and r_match:
            coords['pupils'].append({
                'id': pupil_id,
                'cx': float(cx_match.group(1)),
                'cy': float(cy_match.group(1)),
                'r': float(r_match.group(1))
            })
    
    # Extract eye ellipses (sclera)
    eye_matches = re.finditer(r'<ellipse[^>]*id="(eye[LR])"[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"[^>]*rx="([^"]+)"[^>]*ry="([^"]+)"', svg_content)
    for match in eye_matches:
        coords['eyes'].append({
            'id': match.group(1),
            'cx': float(match.group(2)),
            'cy': float(match.group(3)),
            'rx': float(match.group(4)),
            'ry': float(match.group(5))
        })
    
    return coords

def sample_region(img, x, y, width, height):
    """Sample a region and return average color"""
    samples = []
    sample_points = 25  # 5x5 grid
    grid_size = int(sample_points ** 0.5)
    
    img_width, img_height = img.size
    
    for i in range(grid_size):
        for j in range(grid_size):
            px = int(x + (width * i / (grid_size - 1)))
            py = int(y + (height * j / (grid_size - 1)))
            
            if 0 <= px < img_width and 0 <= py < img_height:
                pixel = img.getpixel((px, py))
                if isinstance(pixel, int):  # Grayscale
                    samples.append({'r': pixel, 'g': pixel, 'b': pixel, 'a': 255})
                elif len(pixel) == 3:  # RGB
                    samples.append({'r': pixel[0], 'g': pixel[1], 'b': pixel[2], 'a': 255})
                else:  # RGBA
                    samples.append({'r': pixel[0], 'g': pixel[1], 'b': pixel[2], 'a': pixel[3]})
    
    if not samples:
        return None
    
    avg = {'r': 0, 'g': 0, 'b': 0, 'a': 0}
    for s in samples:
        avg['r'] += s['r']
        avg['g'] += s['g']
        avg['b'] += s['b']
        avg['a'] += s['a']
    
    count = len(samples)
    return {
        'r': round(avg['r'] / count),
        'g': round(avg['g'] / count),
        'b': round(avg['b'] / count),
        'a': avg['a'] / count
    }

def rgb_to_hex(r, g, b):
    """Convert RGB to hex color"""
    return f'#{r:02x}{g:02x}{b:02x}'

def main():
    if len(sys.argv) < 2:
        print('Usage: python3 scripts/sample_avatar_colors.py <avatar-name>')
        print('Example: python3 scripts/sample_avatar_colors.py marcus')
        sys.exit(1)
    
    avatar_name = sys.argv[1]
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    png_path = os.path.join(project_root, 'public', 'avatars', f'{avatar_name}.png')
    svg_path = os.path.join(project_root, 'public', 'avatars', f'{avatar_name}_hybrid.svg')
    
    if not os.path.exists(png_path):
        print(f'PNG file not found: {png_path}')
        sys.exit(1)
    
    if not os.path.exists(svg_path):
        print(f'SVG file not found: {svg_path}')
        sys.exit(1)
    
    print(f'\nSampling colors from {png_path}...\n')
    
    # Read SVG to extract calibration coordinates
    with open(svg_path, 'r') as f:
        svg_content = f.read()
    
    coords = extract_coords(svg_content)
    
    # Load PNG image
    img = Image.open(png_path)
    img_width, img_height = img.size
    
    # SVG viewBox is 400x400, scale coordinates to actual image size
    scale_x = img_width / 400
    scale_y = img_height / 400
    
    print(f'Image dimensions: {img_width}x{img_height}')
    print(f'Scale factors: {scale_x:.3f}x, {scale_y:.3f}y\n')
    
    results = {
        'mouth': {},
        'eyelids': {},
        'pupils': {},
        'eyes': {}
    }
    
    # Sample mouth region (top, middle, bottom for gradient)
    if coords['mouth']:
        m = coords['mouth']
        mx = m['cx'] * scale_x
        my = m['cy'] * scale_y
        mrx = m['rx'] * scale_x
        mry = m['ry'] * scale_y
        
        # Sample top edge of mouth
        top_color = sample_region(img, mx - mrx/2, my - mry, mrx, 2)
        # Sample middle of mouth
        mid_color = sample_region(img, mx - mrx/2, my - 1, mrx, 2)
        # Sample bottom edge of mouth
        bot_color = sample_region(img, mx - mrx/2, my + mry - 2, mrx, 2)
        
        results['mouth'] = {
            'top': rgb_to_hex(top_color['r'], top_color['g'], top_color['b']) if top_color else None,
            'middle': rgb_to_hex(mid_color['r'], mid_color['g'], mid_color['b']) if mid_color else None,
            'bottom': rgb_to_hex(bot_color['r'], bot_color['g'], bot_color['b']) if bot_color else None,
            'topRaw': top_color,
            'middleRaw': mid_color,
            'bottomRaw': bot_color
        }
        
        print('MOUTH GRADIENT COLORS:')
        if top_color:
            print(f"  Top:    {results['mouth']['top']} (RGB: {top_color['r']}, {top_color['g']}, {top_color['b']})")
        if mid_color:
            print(f"  Middle: {results['mouth']['middle']} (RGB: {mid_color['r']}, {mid_color['g']}, {mid_color['b']})")
        if bot_color:
            print(f"  Bottom: {results['mouth']['bottom']} (RGB: {bot_color['r']}, {bot_color['g']}, {bot_color['b']})")
        print()
    
    # Sample eyelid regions
    if coords['eyelids']:
        print('EYELID COLORS:')
        for lid in coords['eyelids']:
            lx = lid['x'] * scale_x
            ly = lid['y'] * scale_y
            lw = lid['width'] * scale_x
            lh = lid['height'] * scale_y
            
            color = sample_region(img, lx, ly, lw, lh)
            results['eyelids'][lid['id']] = rgb_to_hex(color['r'], color['g'], color['b']) if color else None
            
            if color:
                print(f"  {lid['id']}: {results['eyelids'][lid['id']]} (RGB: {color['r']}, {color['g']}, {color['b']})")
        print()
    
    # Sample pupil regions
    if coords['pupils']:
        print('PUPIL COLORS:')
        for pupil in coords['pupils']:
            px = pupil['cx'] * scale_x
            py = pupil['cy'] * scale_y
            pr = pupil['r'] * scale_x
            
            color = sample_region(img, px - pr, py - pr, pr * 2, pr * 2)
            results['pupils'][pupil['id']] = rgb_to_hex(color['r'], color['g'], color['b']) if color else None
            
            if color:
                print(f"  {pupil['id']}: {results['pupils'][pupil['id']]} (RGB: {color['r']}, {color['g']}, {color['b']})")
        print()
    
    # Sample eye/sclera regions
    if coords['eyes']:
        print('EYE/SCLERA COLORS:')
        for eye in coords['eyes']:
            ex = eye['cx'] * scale_x
            ey = eye['cy'] * scale_y
            erx = eye['rx'] * scale_x
            ery = eye['ry'] * scale_y
            
            color = sample_region(img, ex - erx, ey - ery, erx * 2, ery * 2)
            results['eyes'][eye['id']] = rgb_to_hex(color['r'], color['g'], color['b']) if color else None
            
            if color:
                print(f"  {eye['id']}: {results['eyes'][eye['id']]} (RGB: {color['r']}, {color['g']}, {color['b']})")
        print()
    
    # Output suggested SVG gradient updates
    print('\n=== SUGGESTED SVG UPDATES ===\n')
    
    if results['mouth'].get('top'):
        print('Mouth gradient (gradMouthVert):')
        print(f'  <stop offset="0%" stop-color="{results["mouth"]["top"]}" stop-opacity="0.76"></stop>')
        print(f'  <stop offset="50%" stop-color="{results["mouth"]["middle"]}" stop-opacity="0.87"></stop>')
        print(f'  <stop offset="100%" stop-color="{results["mouth"]["bottom"]}" stop-opacity="0.76"></stop>')
        print()
    
    if results['eyelids']:
        first_lid_color = list(results['eyelids'].values())[0]
        print('Eyelid gradients (gradLidUpper and gradLidLower):')
        print(f'  stop-color="{first_lid_color}"')
        print()
    
    if results['pupils']:
        first_pupil_color = list(results['pupils'].values())[0]
        print('Pupil gradient (gradPupil):')
        print(f'  stop-color="{first_pupil_color}"')
        print()
    
    # Save results to JSON
    output_path = os.path.join(project_root, 'public', 'avatars', f'{avatar_name}_colors.json')
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f'\nColor data saved to: {output_path}\n')

if __name__ == '__main__':
    main()

