from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

def create_app_icon(output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    size = (256, 256)
    image = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    
    # 背景角丸正方形 (インディゴ #4f46e5)
    margin = 8
    radius = 48
    draw.rounded_rectangle(
        [margin, margin, size[0] - margin, size[1] - margin],
        radius=radius,
        fill=(79, 70, 229, 255)
    )
    
    # カンバンボード（3カラム）の描画
    col_w = 46
    col_gap = 14
    start_x = 45
    radius_col = 10
    
    # 左カラム
    draw.rounded_rectangle([start_x, 56, start_x + col_w, 200], radius=radius_col, fill=(255, 255, 255, 255))
    # 中カラム
    mid_x = start_x + col_w + col_gap
    draw.rounded_rectangle([mid_x, 56, mid_x + col_w, 150], radius=radius_col, fill=(255, 255, 255, 255))
    # 右カラム
    right_x = mid_x + col_w + col_gap
    draw.rounded_rectangle([right_x, 56, right_x + col_w, 175], radius=radius_col, fill=(255, 255, 255, 240))
    
    png_path = output_dir / "icon.png"
    ico_path = output_dir / "icon.ico"
    
    image.save(png_path, format="PNG")
    image.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print(f"Icons created at {png_path} and {ico_path}")

def get_font(size: int, bold: bool = False):
    font_paths = [
        "C:/Windows/Fonts/meiryo.ttc" if not bold else "C:/Windows/Fonts/meiryob.ttc",
        "C:/Windows/Fonts/msgothic.ttc",
        "C:/Windows/Fonts/segoeui.ttf" if not bold else "C:/Windows/Fonts/segoeuib.ttf",
        "C:/Windows/Fonts/arial.ttf" if not bold else "C:/Windows/Fonts/arialbd.ttf",
    ]
    for p in font_paths:
        if Path(p).exists():
            try:
                return ImageFont.truetype(p, size=size)
            except Exception:
                continue
    return ImageFont.load_default()

def create_splash_image(output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    width, height = 480, 260
    # RGBで作成（PyInstallerスプラッシュでのTk互換性と安定性を高めるためRGBモード）
    img = Image.new("RGB", (width, height), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    # 外枠線
    draw.rectangle([0, 0, width - 1, height - 1], outline=(226, 232, 240), width=1)

    # ヘッダー背景アクセント（上部わずかなグラデーション風または淡いストライプ）
    draw.rectangle([1, 1, width - 2, 4], fill=(79, 70, 229))

    # アイコン描画 (64x64)
    icon_x, icon_y = 40, 45
    icon_size = 64
    draw.rounded_rectangle(
        [icon_x, icon_y, icon_x + icon_size, icon_y + icon_size],
        radius=14,
        fill=(79, 70, 229)
    )
    # カンバンカラム描画
    draw.rounded_rectangle([icon_x + 11, icon_y + 14, icon_x + 23, icon_y + 50], radius=3, fill=(255, 255, 255))
    draw.rounded_rectangle([icon_x + 26, icon_y + 14, icon_x + 38, icon_y + 38], radius=3, fill=(255, 255, 255))
    draw.rounded_rectangle([icon_x + 41, icon_y + 14, icon_x + 53, icon_y + 44], radius=3, fill=(255, 255, 255))

    # テキスト描画
    font_title = get_font(28, bold=True)
    font_sub = get_font(13)
    font_status = get_font(12)
    font_small = get_font(10)

    # アプリ名
    draw.text((120, 48), "LocalBan", fill=(15, 23, 42), font=font_title)
    # サブタイトル
    draw.text((122, 88), "軽量・オフラインファースト カンバンボード", fill=(100, 116, 139), font=font_sub)

    # 区切り線
    draw.line([(40, 140), (width - 40, 140)], fill=(241, 245, 249), width=1)

    # 進行状況表示
    draw.text((40, 160), "起動準備中...", fill=(71, 85, 105), font=font_status)
    draw.text((width - 40, 160), "しばらくお待ちください", fill=(148, 163, 184), font=font_small, anchor="ra")

    # プログレスバー背景
    bar_x1, bar_y1, bar_x2, bar_y2 = 40, 185, width - 40, 191
    draw.rounded_rectangle([bar_x1, bar_y1, bar_x2, bar_y2], radius=3, fill=(226, 232, 240))
    # プログレスバー（進行状態）
    draw.rounded_rectangle([bar_x1, bar_y1, bar_x1 + 260, bar_y2], radius=3, fill=(79, 70, 229))

    # フッター表示
    draw.text((40, 215), "127.0.0.1 ローカルサーバー起動中", fill=(148, 163, 184), font=font_small)

    splash_path = output_dir / "splash.png"
    img.save(splash_path, format="PNG")
    print(f"Splash screen image created at {splash_path}")

if __name__ == "__main__":
    assets = Path("assets")
    create_app_icon(assets)
    create_splash_image(assets)
