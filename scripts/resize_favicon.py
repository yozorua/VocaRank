from PIL import Image

def generate_icons():
    # Load the ico file
    ico = Image.open('website/src/app/favicon.ico')
    
    # Resize to 512x512 for standard icon.png (Android, etc)
    icon_512 = ico.resize((512, 512), Image.NEAREST)
    icon_512.save('website/src/app/icon.png', 'PNG')
    
    # Resize to 180x180 for apple-touch-icon
    apple_icon = ico.resize((180, 180), Image.NEAREST)
    apple_icon.save('website/src/app/apple-icon.png', 'PNG')
    
    print("Generated icon.png and apple-icon.png successfully.")

if __name__ == "__main__":
    generate_icons()
