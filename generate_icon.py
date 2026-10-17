from PIL import Image, ImageDraw, ImageFont
from pathlib import Path


def draw_localban_icon_master(canvas_size: int = 1024) -> Image.Image:
    """
    LocalBan 独自アプリアイコン（1024x1024 マスター描画）
    コンセプト: 「レイヤード・タスクカード & エメラルド・チェックバッジ」
    ダークスレート背景＋横型積層カード＋完了バッジの独自デザイン。
    """
    s = canvas_size
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. 外枠角丸スクエア (ダークスレート #0f172a + 外周インディゴ/シアンの微細リム)
    margin = int(s * 0.035)
    radius = int(s * 0.21)
    # 外周アクセント枠 (#334155)
    draw.rounded_rectangle(
        [margin, margin, s - margin, s - margin],
        radius=radius,
        fill=(15, 23, 42, 255),
        outline=(51, 65, 85, 255),
        width=int(s * 0.012),
    )

    # 内側上部のハイライトプレート (#1e293b)
    inner_m = margin + int(s * 0.02)
    draw.rounded_rectangle(
        [inner_m, inner_m, s - inner_m, int(s * 0.55)],
        radius=int(radius * 0.88),
        fill=(30, 41, 59, 255),
    )
    # 下半分と馴染ませるベース塗り
    draw.rounded_rectangle(
        [inner_m, int(s * 0.35), s - inner_m, s - inner_m],
        radius=int(radius * 0.88),
        fill=(15, 23, 42, 255),
    )

    # 2. 背面レイヤードカード (ティール/シアン #0ea5e9 -> オフセット配置された2枚目タスクカード)
    back_x1, back_y1 = int(s * 0.23), int(s * 0.16)
    back_x2, back_y2 = int(s * 0.83), int(s * 0.52)
    draw.rounded_rectangle(
        [back_x1, back_y1, back_x2, back_y2],
        radius=int(s * 0.065),
        fill=(14, 165, 233, 235),
    )
    # 背面カード内の装飾ライン
    draw.rounded_rectangle(
        [back_x1 + int(s * 0.06), back_y1 + int(s * 0.06), back_x1 + int(s * 0.24), back_y1 + int(s * 0.095)],
        radius=int(s * 0.018),
        fill=(224, 242, 254, 220),
    )

    # 3. 中間レイヤードカード (アンバー/オレンジアクセント #f59e0b のタグ付きカード)
    mid_x1, mid_y1 = int(s * 0.17), int(s * 0.27)
    mid_x2, mid_y2 = int(s * 0.78), int(s * 0.65)
    draw.rounded_rectangle(
        [mid_x1, mid_y1, mid_x2, mid_y2],
        radius=int(s * 0.068),
        fill=(99, 102, 241, 245),
    )

    # 4. 前面メイン・タスクカード (クリーンなホワイト #f8fafc + 左端エメラルドアクセントバー + 横型タスク行)
    # ドロップシャドウ
    sh_offset = int(s * 0.02)
    card_x1, card_y1 = int(s * 0.13), int(s * 0.38)
    card_x2, card_y2 = int(s * 0.76), int(s * 0.81)
    draw.rounded_rectangle(
        [card_x1 + sh_offset, card_y1 + sh_offset, card_x2 + sh_offset, card_y2 + sh_offset],
        radius=int(s * 0.072),
        fill=(2, 6, 23, 140),
    )
    # ホワイトカード本体
    draw.rounded_rectangle(
        [card_x1, card_y1, card_x2, card_y2],
        radius=int(s * 0.072),
        fill=(255, 255, 255, 255),
    )

    # 前面カード内のカラーラベルピル (アンバー #f59e0b & エメラルド #10b981)
    pill_y = card_y1 + int(s * 0.065)
    pill_h = int(s * 0.042)
    draw.rounded_rectangle(
        [card_x1 + int(s * 0.065), pill_y, card_x1 + int(s * 0.23), pill_y + pill_h],
        radius=int(pill_h / 2),
        fill=(16, 185, 129, 255),
    )
    draw.rounded_rectangle(
        [card_x1 + int(s * 0.26), pill_y, card_x1 + int(s * 0.40), pill_y + pill_h],
        radius=int(pill_h / 2),
        fill=(245, 158, 11, 255),
    )

    # 前面カード内の横型タスクタイトル行・サブ行 (横方向のテキストライン表現)
    line1_y = card_y1 + int(s * 0.155)
    line_h = int(s * 0.046)
    draw.rounded_rectangle(
        [card_x1 + int(s * 0.065), line1_y, card_x1 + int(s * 0.48), line1_y + line_h],
        radius=int(line_h / 2),
        fill=(30, 41, 59, 255),
    )
    line2_y = card_y1 + int(s * 0.235)
    line2_h = int(s * 0.038)
    draw.rounded_rectangle(
        [card_x1 + int(s * 0.065), line2_y, card_x1 + int(s * 0.36), line2_y + line2_h],
        radius=int(line2_h / 2),
        fill=(148, 163, 184, 255),
    )
    # 進捗バー表現
    bar_y = card_y1 + int(s * 0.315)
    bar_h = int(s * 0.026)
    draw.rounded_rectangle(
        [card_x1 + int(s * 0.065), bar_y, card_x1 + int(s * 0.42), bar_y + bar_h],
        radius=int(bar_h / 2),
        fill=(226, 232, 240, 255),
    )
    draw.rounded_rectangle(
        [card_x1 + int(s * 0.065), bar_y, card_x1 + int(s * 0.31), bar_y + bar_h],
        radius=int(bar_h / 2),
        fill=(14, 165, 233, 255),
    )

    # 5. 右下のエメラルド・チェックバッジ (ローカル完結・タスク完了の象徴)
    badge_cx, badge_cy = int(s * 0.72), int(s * 0.71)
    badge_r = int(s * 0.175)
    # バッジ外周のダークリング（カードとの境界を際立たせる）
    ring_w = int(s * 0.025)
    draw.ellipse(
        [badge_cx - badge_r - ring_w, badge_cy - badge_r - ring_w, badge_cx + badge_r + ring_w, badge_cy + badge_r + ring_w],
        fill=(15, 23, 42, 255),
    )
    # エメラルドグリーン円 (#10b981)
    draw.ellipse(
        [badge_cx - badge_r, badge_cy - badge_r, badge_cx + badge_r, badge_cy + badge_r],
        fill=(16, 185, 129, 255),
    )

    # チェックマークの描画
    p1 = (badge_cx - int(badge_r * 0.42), badge_cy + int(badge_r * 0.02))
    p2 = (badge_cx - int(badge_r * 0.10), badge_cy + int(badge_r * 0.36))
    p3 = (badge_cx + int(badge_r * 0.46), badge_cy - int(badge_r * 0.30))
    stroke_w = int(s * 0.044)
    draw.line([p1, p2, p3], fill=(255, 255, 255, 255), width=stroke_w, joint="curve")
    # 端点の丸み処理
    for pt in (p1, p2, p3):
        r_pt = stroke_w // 2
        draw.ellipse([pt[0] - r_pt, pt[1] - r_pt, pt[0] + r_pt, pt[1] + r_pt], fill=(255, 255, 255, 255))

    return img


def create_app_icon(assets_dir: Path, tauri_icons_dir: Path):
    assets_dir.mkdir(parents=True, exist_ok=True)
    tauri_icons_dir.mkdir(parents=True, exist_ok=True)

    master = draw_localban_icon_master(1024)
    icon_256 = master.resize((256, 256), Image.Resampling.LANCZOS)
    icon_128 = master.resize((128, 128), Image.Resampling.LANCZOS)
    icon_32 = master.resize((32, 32), Image.Resampling.LANCZOS)

    # assets/ への保存
    png_path = assets_dir / "icon.png"
    ico_path = assets_dir / "icon.ico"
    icon_256.save(png_path, format="PNG")
    master.save(
        ico_path,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    # src-tauri/icons/ への保存
    icon_256.save(tauri_icons_dir / "icon.png", format="PNG")
    icon_128.save(tauri_icons_dir / "128x128.png", format="PNG")
    icon_32.save(tauri_icons_dir / "32x32.png", format="PNG")
    master.save(
        tauri_icons_dir / "icon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print(f"Updated icons in {assets_dir} and {tauri_icons_dir}")


def get_font(size: int, bold: bool = False):
    font_paths = [
        "C:/Windows/Fonts/meiryo.ttc" if not bold else "C:/Windows/Fonts/meiryob.ttc",
        "C:/Windows/Fonts/YuGothM.ttc" if not bold else "C:/Windows/Fonts/YuGothB.ttc",
        "C:/Windows/Fonts/msgothic.ttc",
        "C:/Windows/Fonts/segoeui.ttf" if not bold else "C:/Windows/Fonts/segoeuib.ttf",
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
    img = Image.new("RGB", (width, height), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    # 外枠線
    draw.rectangle([0, 0, width - 1, height - 1], outline=(226, 232, 240), width=1)
    # ヘッダー上部アクセントバー (エメラルド〜スレート)
    draw.rectangle([1, 1, width - 2, 5], fill=(16, 185, 129))

    # 新アイコン (64x64) の貼り付け
    icon_64 = draw_localban_icon_master(512).resize((64, 64), Image.Resampling.LANCZOS)
    img.paste(icon_64, (40, 45), icon_64)

    font_title = get_font(28, bold=True)
    font_sub = get_font(13)
    font_status = get_font(12)
    font_small = get_font(10)

    draw.text((120, 48), "LocalBan", fill=(15, 23, 42), font=font_title)
    draw.text((122, 88), "軽量・オフラインファースト カンバンボード", fill=(100, 116, 139), font=font_sub)

    draw.line([(40, 140), (width - 40, 140)], fill=(241, 245, 249), width=1)

    draw.text((40, 160), "起動準備中...", fill=(71, 85, 105), font=font_status)
    draw.text((width - 40, 160), "しばらくお待ちください", fill=(148, 163, 184), font=font_small, anchor="ra")

    bar_x1, bar_y1, bar_x2, bar_y2 = 40, 185, width - 40, 191
    draw.rounded_rectangle([bar_x1, bar_y1, bar_x2, bar_y2], radius=3, fill=(226, 232, 240))
    draw.rounded_rectangle([bar_x1, bar_y1, bar_x1 + 280, bar_y2], radius=3, fill=(16, 185, 129))

    draw.text((40, 215), "完全オフライン・ローカルデータベース起動中", fill=(148, 163, 184), font=font_small)

    splash_path = output_dir / "splash.png"
    img.save(splash_path, format="PNG")
    print(f"Splash screen image created at {splash_path}")


if __name__ == "__main__":
    root = Path(__file__).resolve().parent
    create_app_icon(root / "assets", root / "src-tauri" / "icons")
    create_splash_image(root / "assets")
