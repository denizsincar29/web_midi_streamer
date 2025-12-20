#!/usr/bin/env python3
"""
Generate PWA icons for Web MIDI Streamer
Creates 192x192 and 512x512 PNG icons with piano keys and connection symbols
"""

from PIL import Image, ImageDraw, ImageFont
import math

def create_gradient_background(width, height):
    """Create a purple gradient background"""
    image = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(image)
    
    # Purple gradient colors
    color1 = (102, 126, 234)  # #667eea
    color2 = (118, 75, 162)   # #764ba2
    
    # Draw gradient
    for y in range(height):
        # Calculate color interpolation
        ratio = y / height
        r = int(color1[0] * (1 - ratio) + color2[0] * ratio)
        g = int(color1[1] * (1 - ratio) + color2[1] * ratio)
        b = int(color1[2] * (1 - ratio) + color2[2] * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    
    return image

def draw_piano_keys(draw, center_x, center_y, scale=1.0):
    """Draw simplified piano keys"""
    key_width = int(30 * scale)
    key_height = int(120 * scale)
    black_key_width = int(20 * scale)
    black_key_height = int(75 * scale)
    spacing = int(5 * scale)
    
    # Draw 5 white keys
    white_keys = []
    for i in range(5):
        x = center_x - (2.5 * key_width) - (2 * spacing) + i * (key_width + spacing)
        white_keys.append((x, center_y - key_height // 2, x + key_width, center_y + key_height // 2))
        draw.rounded_rectangle(white_keys[-1], radius=int(3 * scale), fill='white', outline='#333', width=int(2 * scale))
    
    # Draw 3 black keys (between white keys)
    black_key_positions = [0, 1, 3]  # Skip position 2 (like real piano)
    for i in black_key_positions:
        x = white_keys[i][2] - black_key_width // 2
        y = center_y - key_height // 2
        draw.rounded_rectangle(
            (x, y, x + black_key_width, y + black_key_height),
            radius=int(2 * scale),
            fill='#333'
        )

def draw_connection_symbol(draw, center_x, center_y, scale=1.0):
    """Draw connection/wire symbol (two nodes connected by line)"""
    node_radius = int(15 * scale)
    line_width = int(4 * scale)
    offset = int(60 * scale)
    
    # Left node
    left_x = center_x - offset
    draw.ellipse(
        (left_x - node_radius, center_y - node_radius, 
         left_x + node_radius, center_y + node_radius),
        fill='white',
        outline='#333',
        width=int(2 * scale)
    )
    
    # Right node
    right_x = center_x + offset
    draw.ellipse(
        (right_x - node_radius, center_y - node_radius,
         right_x + node_radius, center_y + node_radius),
        fill='white',
        outline='#333',
        width=int(2 * scale)
    )
    
    # Connecting line with curve
    draw.arc(
        (left_x - offset, center_y - offset // 2,
         right_x + offset, center_y + offset // 2),
        start=-180,
        end=0,
        fill='white',
        width=line_width
    )

def create_icon(size):
    """Create a single icon of the specified size"""
    # Create base image with gradient
    image = create_gradient_background(size, size)
    draw = ImageDraw.Draw(image)
    
    # Calculate scale based on size
    scale = size / 512
    
    # Draw piano keys in the center
    center_x = size // 2
    center_y = size // 2
    draw_piano_keys(draw, center_x, center_y, scale)
    
    # Draw connection symbol above piano
    draw_connection_symbol(draw, center_x, int(center_y - 100 * scale), scale * 0.6)
    
    return image

def main():
    """Generate all required icon sizes"""
    sizes = [192, 512]
    
    for size in sizes:
        print(f"Generating {size}x{size} icon...")
        icon = create_icon(size)
        filename = f"icons/icon-{size}x{size}.png"
        icon.save(filename, 'PNG', optimize=True)
        print(f"✓ Saved {filename}")
    
    print("\n✅ All icons generated successfully!")

if __name__ == "__main__":
    main()
