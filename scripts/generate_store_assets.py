import sys
from pathlib import Path
from PIL import Image, ImageDraw

root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))
from generate_icon import draw_localban_icon_master, get_font


def draw_badge_pill(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    text: str,
    bg_color,
    text_color,
    font,
    pad_x=18,
    pad_y=8,
    radius=16,
    border_color=None,
):
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    w = tw + pad_x * 2
    h = th + pad_y * 2
    draw.rounded_rectangle(
        [x, y, x + w, y + h],
        radius=radius,
        fill=bg_color,
        outline=border_color,
        width=1 if border_color else 0,
    )
    draw.text((x + pad_x, y + pad_y - 2), text, fill=text_color, font=font)
    return w, h


def draw_app_header_bar(
    img: Image.Image,
    draw: ImageDraw.ImageDraw,
    wx: int,
    wy: int,
    ww: int,
    icon_small: Image.Image,
):
    """実際の LocalBan アプリヘッダーを忠実に描画（文字化けゼロ設計）"""
    draw.rounded_rectangle([wx, wy, wx + ww, wy + 38], radius=16, fill=(241, 245, 249))
    draw.rectangle([wx, wy + 20, wx + ww, wy + 38], fill=(241, 245, 249))
    font_win = get_font(12)
    draw.text((wx + 18, wy + 10), "LocalBan", fill=(71, 85, 105), font=font_win)
    draw.text((wx + ww - 110, wy + 9), "─     □     ×", fill=(100, 116, 139), font=font_win)

    hy = wy + 38
    draw.rectangle([wx, hy, wx + ww, hy + 58], fill=(255, 255, 255))
    draw.line([(wx, hy + 58), (wx + ww, hy + 58)], fill=(226, 232, 240), width=2)

    img.paste(icon_small, (wx + 22, hy + 13), icon_small)
    font_logo = get_font(21, bold=True)
    font_badge = get_font(12, bold=True)
    font_btn = get_font(13, bold=True)

    draw.text((wx + 64, hy + 15), "LocalBan", fill=(15, 23, 42), font=font_logo)
    draw_badge_pill(
        draw,
        wx + 172,
        hy + 18,
        "v2.0.0",
        (236, 253, 245),
        (4, 120, 87),
        font_badge,
        pad_x=10,
        pad_y=4,
        radius=8,
        border_color=(167, 243, 208),
    )
    draw_badge_pill(
        draw,
        wx + 240,
        hy + 18,
        "オフライン",
        (241, 245, 249),
        (100, 116, 139),
        font_badge,
        pad_x=12,
        pad_y=4,
        radius=12,
    )

    cx = wx + ww // 2 - 55
    draw_badge_pill(
        draw,
        cx,
        hy + 16,
        "✓ 保存済み",
        (236, 253, 245),
        (5, 150, 105),
        font_btn,
        pad_x=14,
        pad_y=5,
        radius=14,
        border_color=(167, 243, 208),
    )

    rx = wx + ww - 540
    draw_badge_pill(
        draw,
        rx,
        hy + 15,
        "×: トレイ格納",
        (238, 242, 255),
        (67, 56, 202),
        font_badge,
        pad_x=12,
        pad_y=6,
        radius=8,
        border_color=(199, 210, 254),
    )
    draw_badge_pill(
        draw,
        rx + 122,
        hy + 15,
        "ショートカット [?]",
        (241, 245, 249),
        (71, 85, 105),
        font_badge,
        pad_x=12,
        pad_y=6,
        radius=8,
    )
    draw_badge_pill(
        draw,
        rx + 272,
        hy + 15,
        "規約・免責",
        (241, 245, 249),
        (71, 85, 105),
        font_badge,
        pad_x=12,
        pad_y=6,
        radius=8,
    )
    draw_badge_pill(
        draw,
        rx + 372,
        hy + 15,
        "アーカイブ",
        (241, 245, 249),
        (51, 65, 85),
        font_badge,
        pad_x=12,
        pad_y=6,
        radius=8,
    )
    draw_badge_pill(
        draw,
        rx + 468,
        hy + 15,
        "終了",
        (255, 241, 242),
        (190, 18, 60),
        font_badge,
        pad_x=12,
        pad_y=6,
        radius=8,
        border_color=(254, 205, 211),
    )

    return hy + 59


def draw_promo_header(
    img: Image.Image,
    draw: ImageDraw.ImageDraw,
    icon_lg: Image.Image,
    step_badge: str,
    title: str,
    subtitle: str,
    pills: list[str],
):
    """スクリーンショット上部のプロモーション・キャッチコピーヘッダー"""
    draw.rectangle([0, 0, 1920, 1080], fill=(15, 23, 42))
    draw.ellipse([-200, -300, 900, 500], fill=(30, 41, 59))
    draw.ellipse([1200, -250, 2150, 600], fill=(17, 34, 64))

    img.paste(icon_lg, (84, 38), icon_lg)

    font_step = get_font(15, bold=True)
    font_title = get_font(38, bold=True)
    font_sub = get_font(19)
    font_pill = get_font(15, bold=True)

    draw_badge_pill(
        draw,
        192,
        36,
        step_badge,
        (16, 185, 129),
        (255, 255, 255),
        font_step,
        pad_x=14,
        pad_y=4,
        radius=10,
    )

    draw.text((192, 74), title, fill=(255, 255, 255), font=font_title)
    draw.text((194, 128), subtitle, fill=(148, 163, 184), font=font_sub)

    px = 1920 - 84
    for p_text in reversed(pills):
        bbox = draw.textbbox((0, 0), p_text, font=font_pill)
        pw = (bbox[2] - bbox[0]) + 32
        px -= pw
        draw_badge_pill(
            draw,
            px,
            52,
            p_text,
            (30, 41, 59),
            (56, 189, 248),
            font_pill,
            pad_x=16,
            pad_y=8,
            radius=12,
            border_color=(51, 65, 85),
        )
        px -= 12


def generate_msix_assets(output_dir: Path):
    """MSIX パッケージ必須の5種のタイル・ロゴアセットを生成"""
    output_dir.mkdir(parents=True, exist_ok=True)
    master = draw_localban_icon_master(1024)

    square_specs = {
        "StoreLogo.png": (50, 50),
        "Square44x44Logo.png": (44, 44),
        "Square150x150Logo.png": (150, 150),
        "Square310x310Logo.png": (310, 310),
    }
    for filename, size in square_specs.items():
        resized = master.resize(size, Image.Resampling.LANCZOS)
        resized.save(output_dir / filename, format="PNG")

    wide = Image.new("RGBA", (310, 150), (15, 23, 42, 255))
    w_draw = ImageDraw.Draw(wide)
    w_draw.rounded_rectangle(
        [2, 2, 307, 147],
        radius=14,
        fill=(15, 23, 42, 255),
        outline=(51, 65, 85, 255),
        width=2,
    )
    icon_96 = master.resize((96, 96), Image.Resampling.LANCZOS)
    wide.paste(icon_96, (28, 27), icon_96)
    f_title = get_font(28, bold=True)
    f_sub = get_font(12, bold=True)
    w_draw.text((138, 44), "LocalBan", fill=(255, 255, 255, 255), font=f_title)
    w_draw.text((140, 84), "Offline Kanban Board", fill=(52, 211, 153, 255), font=f_sub)
    wide.save(output_dir / "Wide310x150Logo.png", format="PNG")
    print(f"Generated 5 MSIX visual assets in {output_dir}")


def create_screenshot_01_main_board(output_dir: Path, icon_lg: Image.Image, icon_sm: Image.Image):
    """スクショ1: メインの3カラムカンバンボード全体像"""
    img = Image.new("RGB", (1920, 1080), (15, 23, 42))
    draw = ImageDraw.Draw(img)

    draw_promo_header(
        img,
        draw,
        icon_lg,
        "FEATURE 01  |  OFFLINE-FIRST KANBAN",
        "完全オフライン・超軽量。あなただけの高速カンバンボード",
        "Tauri v2 (Full Rust) ネイティブ動作。アカウント登録不要・外部通信ゼロで瞬時に起動し、ドラッグ＆ドロップで直感整理",
        ["◆ Full Rust 高速動作", "◆ 完全ローカル保存", "◆ カラーラベル & カバー画像"],
    )

    wx, wy, ww, wh = 84, 178, 1752, 852
    draw.rounded_rectangle([wx - 2, wy - 2, wx + ww + 2, wy + wh + 2], radius=18, fill=(51, 65, 85))
    draw.rounded_rectangle([wx, wy, wx + ww, wy + wh], radius=16, fill=(241, 245, 249))

    body_y = draw_app_header_bar(img, draw, wx, wy, ww, icon_sm)

    columns = [
        {
            "title": "ToDo（未着手）",
            "count": "3",
            "cards": [
                {
                    "labels": [("重要", (239, 68, 68)), ("設計", (99, 102, 241))],
                    "lines": ["LocalBan へようこそ！基本操作の確認"],
                    "due": ("10月20日 18:00", (180, 83, 9), (254, 243, 199)),
                    "check": "2/3",
                    "has_desc": True,
                    "selected": True,
                },
                {
                    "labels": [("機能開発", (16, 185, 129))],
                    "lines": ["ショートカット (c / n / 1〜9) での", "高速カード連続作成"],
                    "due": None,
                    "check": "0/4",
                    "has_desc": True,
                    "selected": False,
                },
                {
                    "labels": [("ドキュメント", (14, 165, 233))],
                    "lines": ["四半期タスクの整理と優先度ラベリング"],
                    "due": ("10月25日", (100, 116, 139), (241, 245, 249)),
                    "check": None,
                    "has_desc": False,
                    "selected": False,
                },
            ],
        },
        {
            "title": "進行中 (In Progress)",
            "count": "2",
            "cards": [
                {
                    "cover": True,
                    "labels": [("UI/UX", (168, 85, 247)), ("優先", (245, 158, 11))],
                    "lines": ["カード詳細モーダルでの GFM Markdown", "・ノート記法プレビュー検証"],
                    "due": ("今日 17:00", (180, 83, 9), (254, 243, 199)),
                    "check": "4/5",
                    "has_desc": True,
                    "selected": False,
                },
                {
                    "labels": [("Rust / SQLite", (16, 185, 129))],
                    "lines": ["起動時の自動オンラインバックアップ", "（最新7世代保持）の動作確認"],
                    "due": None,
                    "check": "2/2",
                    "has_desc": True,
                    "selected": False,
                },
            ],
        },
        {
            "title": "完了 (Done)",
            "count": "2",
            "cards": [
                {
                    "labels": [("リリース準備", (16, 185, 129))],
                    "lines": ["ネイティブ実行ファイル & MSIX パッケージ", "のビルドパイプライン構成"],
                    "due": ("完了済み", (5, 150, 105), (209, 250, 229)),
                    "check": "5/5",
                    "has_desc": True,
                    "selected": False,
                },
                {
                    "labels": [("セキュリティ", (14, 165, 233))],
                    "lines": ["完全オフライン境界（外部ネットワーク", "通信ゼロ）のセキュリティ検証完了"],
                    "due": ("完了済み", (5, 150, 105), (209, 250, 229)),
                    "check": "3/3",
                    "has_desc": True,
                    "selected": False,
                },
            ],
        },
    ]

    f_col_title = get_font(16, bold=True)
    f_card_title = get_font(14, bold=True)
    f_small = get_font(12, bold=True)
    f_meta = get_font(12)

    col_w = 410
    col_gap = 28
    start_x = wx + 32
    col_y = body_y + 26

    for idx, col in enumerate(columns):
        cx = start_x + idx * (col_w + col_gap)
        ch = 710
        draw.rounded_rectangle(
            [cx, col_y, cx + col_w, col_y + ch],
            radius=14,
            fill=(226, 232, 240),
            outline=(203, 213, 225),
            width=1,
        )
        draw.text((cx + 18, col_y + 16), col["title"], fill=(30, 41, 59), font=f_col_title)
        draw_badge_pill(
            draw,
            cx + col_w - 62,
            col_y + 15,
            col["count"],
            (203, 213, 225),
            (51, 65, 85),
            f_small,
            pad_x=10,
            pad_y=3,
            radius=10,
        )

        cy = col_y + 56
        for card in col["cards"]:
            has_cover = card.get("cover", False)
            card_h = 198 if has_cover else 136
            border_c = (79, 70, 229) if card.get("selected") else (203, 213, 225)
            border_w = 2 if card.get("selected") else 1

            draw.rounded_rectangle(
                [cx + 12, cy, cx + col_w - 12, cy + card_h],
                radius=12,
                fill=(255, 255, 255),
                outline=border_c,
                width=border_w,
            )

            inner_y = cy + 14
            if has_cover:
                draw.rounded_rectangle([cx + 14, cy + 2, cx + col_w - 14, cy + 68], radius=10, fill=(30, 41, 59))
                draw.rounded_rectangle([cx + 28, cy + 14, cx + 118, cy + 54], radius=6, fill=(14, 165, 233))
                draw.rounded_rectangle([cx + 130, cy + 14, cx + 225, cy + 54], radius=6, fill=(16, 185, 129))
                draw.text((cx + 240, cy + 25), "★ カバー画像プレビュー", fill=(226, 232, 240), font=f_meta)
                inner_y = cy + 78

            lx = cx + 24
            for l_name, l_col in card["labels"]:
                w_pill, _ = draw_badge_pill(
                    draw, lx, inner_y, l_name, l_col, (255, 255, 255), f_small, pad_x=10, pad_y=2, radius=6
                )
                lx += w_pill + 8

            for l_idx, line_str in enumerate(card["lines"]):
                draw.text((cx + 24, inner_y + 28 + l_idx * 22), line_str, fill=(15, 23, 42), font=f_card_title)

            my = cy + card_h - 32
            mx = cx + 24
            if card["due"]:
                d_text, d_fg, d_bg = card["due"]
                pw, _ = draw_badge_pill(
                    draw, mx, my, f"● {d_text}", d_bg, d_fg, f_small, pad_x=8, pad_y=2, radius=6
                )
                mx += pw + 10
            if card["check"]:
                is_done = card["check"] in ("2/2", "5/5", "3/3")
                c_bg = (209, 250, 229) if is_done else (241, 245, 249)
                c_fg = (5, 150, 105) if is_done else (71, 85, 105)
                pw, _ = draw_badge_pill(
                    draw, mx, my, f"✓ {card['check']}", c_bg, c_fg, f_small, pad_x=8, pad_y=2, radius=6
                )
                mx += pw + 10
            if card["has_desc"]:
                draw.text((mx, my + 2), "≡ Markdown詳細", fill=(100, 116, 139), font=f_meta)

            cy += card_h + 14

        draw.text((cx + 22, col_y + ch - 38), "＋ カードを追加  (ショートカット: c / 1〜3)", fill=(100, 116, 139), font=f_meta)

    add_x = start_x + 3 * (col_w + col_gap)
    draw.rounded_rectangle(
        [add_x, col_y, add_x + 340, col_y + 56],
        radius=14,
        fill=(255, 255, 255),
        outline=(203, 213, 225),
        width=1,
    )
    draw.text((add_x + 22, col_y + 18), "＋ もう1つリストを追加", fill=(71, 85, 105), font=f_col_title)

    out_path = output_dir / "01_main_board_1920x1080.png"
    img.save(out_path, format="PNG")
    print(f"Created {out_path}")


def create_screenshot_02_card_detail(output_dir: Path, icon_lg: Image.Image, icon_sm: Image.Image):
    """スクショ2: カード詳細モーダル（GFM Markdown・ノート記法・チェックリスト・画像添付）"""
    img = Image.new("RGB", (1920, 1080), (15, 23, 42))
    draw = ImageDraw.Draw(img)

    draw_promo_header(
        img,
        draw,
        icon_lg,
        "FEATURE 02  |  RICH CARD DETAILS & MARKDOWN",
        "Markdown・ノート記法・画像貼り付け・チェックリストを1枚に凝縮",
        "見出し・表・コード・Qiita互換ノート記法（:::note）、Ctrl+V クリップボード画像貼付、進捗バー付きチェックリストに対応",
        ["◆ GFM Markdown + :::note", "◆ Ctrl+V 画像直接貼付", "◆ 複数チェックリスト進捗バー"],
    )

    wx, wy, ww, wh = 84, 178, 1752, 852
    draw.rounded_rectangle([wx - 2, wy - 2, wx + ww + 2, wy + wh + 2], radius=18, fill=(51, 65, 85))
    draw.rounded_rectangle([wx, wy, wx + ww, wy + wh], radius=16, fill=(203, 213, 225))
    body_y = draw_app_header_bar(img, draw, wx, wy, ww, icon_sm)
    draw.rectangle([wx, body_y, wx + ww, wy + wh], fill=(100, 116, 139))

    mx, my, mw, mh = wx + 170, body_y + 24, 1412, 710
    draw.rounded_rectangle([mx, my, mx + mw, my + mh], radius=18, fill=(255, 255, 255), outline=(226, 232, 240), width=2)

    f_h2 = get_font(22, bold=True)
    f_sec = get_font(15, bold=True)
    f_body = get_font(14)
    f_mono = get_font(13)
    f_small = get_font(12, bold=True)

    draw.text((mx + 36, my + 26), "リリース前チェック & アーキテクチャ仕様レビュー", fill=(15, 23, 42), font=f_h2)
    draw.text(
        (mx + 36, my + 58),
        "リスト: 進行中 (In Progress)   |   ショートカット: [e] 説明編集  [d] 期限設定  [t] チェックリスト追加",
        fill=(100, 116, 139),
        font=f_small,
    )

    draw_badge_pill(draw, mx + 36, my + 88, "重要・最優先", (239, 68, 68), (255, 255, 255), f_small, pad_x=12, pad_y=4, radius=6)
    draw_badge_pill(draw, mx + 148, my + 88, "Rust / Tauri v2", (16, 185, 129), (255, 255, 255), f_small, pad_x=12, pad_y=4, radius=6)
    draw_badge_pill(
        draw,
        mx + 292,
        my + 88,
        "● 期限: 2026/10/20 18:00 (24時間以内)",
        (254, 243, 199),
        (180, 83, 9),
        f_small,
        pad_x=14,
        pad_y=4,
        radius=6,
        border_color=(253, 230, 138),
    )

    lx = mx + 36
    ly = my + 134
    lw = 860
    draw.text((lx, ly), "■ 説明 (GFM Markdown + ノート記法プレビュー)", fill=(30, 41, 59), font=f_sec)
    draw_badge_pill(draw, lx + lw - 150, ly - 4, "編集 [e] / Ctrl+Shift+P", (241, 245, 249), (71, 85, 105), f_small, pad_x=10, pad_y=3, radius=6)

    draw.rounded_rectangle([lx, ly + 30, lx + lw, ly + 300], radius=12, fill=(248, 250, 252), outline=(226, 232, 240), width=1)
    draw.rounded_rectangle([lx + 18, ly + 46, lx + lw - 18, ly + 128], radius=8, fill=(239, 246, 255), outline=(191, 219, 254), width=1)
    draw.rectangle([lx + 18, ly + 46, lx + 24, ly + 128], fill=(59, 130, 246))
    draw.text((lx + 36, ly + 56), "◆ 設計ポイント (:::note info 記法)", fill=(30, 64, 175), font=f_sec)
    draw.text(
        (lx + 36, ly + 84),
        "すべてのデータは %APPDATA%\\LocalBan\\localban.db (SQLite WAL) に保存され、外部通信は一切発生しません。",
        fill=(30, 58, 138),
        font=f_body,
    )

    draw.text((lx + 22, ly + 144), "・パストラバーサル防止および UUID ファイル名による安全な添付ファイル管理", fill=(51, 65, 85), font=f_body)
    draw.text((lx + 22, ly + 172), "・生 HTML タグの無効化による XSS インジェクション完全防止", fill=(51, 65, 85), font=f_body)
    draw.rounded_rectangle([lx + 22, ly + 206, lx + lw - 22, ly + 282], radius=8, fill=(15, 23, 42))
    draw.text((lx + 38, ly + 220), "$ cargo test --manifest-path src-tauri/Cargo.toml", fill=(56, 189, 248), font=f_mono)
    draw.text((lx + 38, ly + 246), "test result: ok. 9 passed; 0 failed; finished in 0.12s", fill=(52, 211, 153), font=f_mono)

    cly = ly + 320
    draw.text((lx, cly), "■ 公開前検証チェックリスト", fill=(30, 41, 59), font=f_sec)
    draw.text((lx + lw - 60, cly), "75%", fill=(16, 185, 129), font=f_sec)
    draw.rounded_rectangle([lx, cly + 28, lx + lw, cly + 38], radius=5, fill=(226, 232, 240))
    draw.rounded_rectangle([lx, cly + 28, lx + int(lw * 0.75), cly + 38], radius=5, fill=(16, 185, 129))

    items = [
        (True, "MSIX マニフェスト (AppxManifest.xml) の Identity / Publisher 設定"),
        (True, "ウィンドウ「×」ボタンのトレイ格納・完全終了切替トグル実装"),
        (True, "アプリ内プライバシーポリシー・免責事項モーダル (InfoModal) の実装"),
        (False, "Windows App Certification Kit (WACK) 最終検証の実行"),
    ]
    for i, (done, text) in enumerate(items):
        iy = cly + 52 + i * 38
        box_col = (16, 185, 129) if done else (255, 255, 255)
        border_col = (16, 185, 129) if done else (148, 163, 184)
        draw.rounded_rectangle([lx + 8, iy, lx + 30, iy + 22], radius=5, fill=box_col, outline=border_col, width=2)
        if done:
            draw.text((lx + 12, iy - 1), "✓", fill=(255, 255, 255), font=f_small)
        txt_col = (148, 163, 184) if done else (30, 41, 59)
        draw.text((lx + 42, iy + 1), text, fill=txt_col, font=f_body)

    rx = lx + lw + 36
    rw = 440
    draw.text((rx, ly), "■ 添付ファイル (Ctrl+V で直接貼付可能)", fill=(30, 41, 59), font=f_sec)
    draw.rounded_rectangle([rx, ly + 30, rx + rw, ly + 210], radius=12, fill=(248, 250, 252), outline=(203, 213, 225), width=1)
    draw.rounded_rectangle([rx + 16, ly + 46, rx + 190, ly + 166], radius=8, fill=(15, 23, 42))
    img.paste(icon_sm, (rx + 84, ly + 86), icon_sm)
    draw.text((rx + 208, ly + 52), "store_architecture.png", fill=(15, 23, 42), font=f_sec)
    draw.text((rx + 208, ly + 80), "サイズ: 142 KB  |  PNG 画像", fill=(100, 116, 139), font=f_small)
    draw_badge_pill(draw, rx + 208, ly + 112, "★ カバー画像に設定中", (238, 242, 255), (79, 70, 229), f_small, pad_x=10, pad_y=4, radius=6)
    draw_badge_pill(draw, rx + 208, ly + 146, "保存 / 拡大表示", (241, 245, 249), (71, 85, 105), f_small, pad_x=10, pad_y=4, radius=6)

    qy = ly + 235
    draw.text((rx, qy), "■ カード操作・ショートカット", fill=(30, 41, 59), font=f_sec)
    actions = [
        ("▶ ラベルを編集", "6色のカラーラベルを割り当て"),
        ("▶ 期限 (Due Date) 設定 [d]", "日時ピッカーと4色ステータスバッジ"),
        ("▶ カードを複製 [c]", "チェックリスト・添付画像も丸ごと複製"),
        ("▶ アーカイブへ送る [a]", "誤削除を防ぐ2段階安全アーカイブ"),
    ]
    for idx, (act_t, act_sub) in enumerate(actions):
        ay = qy + 32 + idx * 62
        draw.rounded_rectangle([rx, ay, rx + rw, ay + 52], radius=10, fill=(248, 250, 252), outline=(226, 232, 240), width=1)
        draw.text((rx + 16, ay + 8), act_t, fill=(30, 41, 59), font=f_sec)
        draw.text((rx + 16, ay + 30), act_sub, fill=(100, 116, 139), font=f_small)

    out_path = output_dir / "02_card_detail_markdown_1920x1080.png"
    img.save(out_path, format="PNG")
    print(f"Created {out_path}")


def create_screenshot_03_keyboard_shortcuts(output_dir: Path, icon_lg: Image.Image, icon_sm: Image.Image):
    """スクショ3: フルキーボードショートカット一覧 & 高速操作体系"""
    img = Image.new("RGB", (1920, 1080), (15, 23, 42))
    draw = ImageDraw.Draw(img)

    draw_promo_header(
        img,
        draw,
        icon_lg,
        "FEATURE 03  |  KEYBOARD-FIRST WORKFLOW",
        "マウスいらずの爆速操作。フルキーボードショートカット対応",
        "カード連続作成（Enter）、保存して詳細展開（Shift+Enter）、矢印キーでのフォーカス移動、日本語 IME 変換ガード完備",
        ["◆ [?] でいつでも一覧表示", "◆ 1〜9 キーでリスト指定作成", "◆ 日本語 IME 誤爆防止ガード"],
    )

    wx, wy, ww, wh = 84, 178, 1752, 852
    draw.rounded_rectangle([wx - 2, wy - 2, wx + ww + 2, wy + wh + 2], radius=18, fill=(51, 65, 85))
    draw.rounded_rectangle([wx, wy, wx + ww, wy + wh], radius=16, fill=(203, 213, 225))
    body_y = draw_app_header_bar(img, draw, wx, wy, ww, icon_sm)
    draw.rectangle([wx, body_y, wx + ww, wy + wh], fill=(100, 116, 139))

    mx, my, mw, mh = wx + 210, body_y + 30, 1332, 695
    draw.rounded_rectangle([mx, my, mx + mw, my + mh], radius=18, fill=(255, 255, 255), outline=(226, 232, 240), width=2)

    f_h2 = get_font(22, bold=True)
    f_sec = get_font(16, bold=True)
    f_body = get_font(14)
    f_kbd = get_font(13, bold=True)

    draw.text((mx + 38, my + 26), "■ キーボードショートカット一覧", fill=(15, 23, 42), font=f_h2)
    draw.text((mx + 38, my + 58), "すべてのショートカットは日本語入力（IME変換中）を自動検知し、誤動作を防止します。", fill=(100, 116, 139), font=f_body)
    draw.line([(mx, my + 90), (mx + mw, my + 90)], fill=(226, 232, 240), width=1)

    sections = [
        (
            "◆ ボード・カード作成操作",
            [
                ("c / n", "選択中（または先頭）のリストでカード作成を開始"),
                ("1 〜 9", "左から N 番目のリストで直接カード作成を開始"),
                ("Enter", "カードを保存し、続けて次のカードを連続作成"),
                ("Ctrl + Enter", "カードを保存して入力フォームを閉じる"),
                ("Shift + Enter", "カードを保存し、そのままカード詳細モーダルを開く"),
            ],
        ),
        (
            "◆ ボード内ナビゲーション",
            [
                ("↑ / ↓", "同一リスト内のカード選択フォーカスを上下に移動"),
                ("← / →", "隣接する左右のリストへ選択フォーカスを移動"),
                ("Enter / Space", "現在フォーカス中のカード詳細モーダルを開く"),
                ("?", "キーボードショートカット一覧モーダルを開閉"),
                ("Esc", "開いているモーダルや入力フォームを閉じる"),
            ],
        ),
        (
            "◆ カード詳細モーダル内操作",
            [
                ("e", "説明文（Markdown）の編集モードを開始"),
                ("d", "期限（Due Date）設定ピッカーを開く"),
                ("t / -", "新しいチェックリストを追加"),
                ("c", "現在のカードを複製（添付・チェックリスト含む）"),
                ("a", "現在のカードをアーカイブへ移動"),
            ],
        ),
        (
            "◆ Markdown エディタ装飾ショートカット",
            [
                ("Ctrl + Shift + P", "Markdown 編集 ⇔ プレビュー表示をワンタッチ切替"),
                ("Ctrl + B / Ctrl + I", "太字 (**text**) / 斜体 (*text*) の挿入"),
                ("Ctrl + K", "リンク [title](url) の挿入"),
                ("Ctrl + Shift + C", "コードブロック (```) の挿入"),
                ("Ctrl + V", "クリップボードの画像をカードに直接貼り付け"),
            ],
        ),
    ]

    for s_idx, (sec_title, rows) in enumerate(sections):
        col_idx = s_idx % 2
        row_idx = s_idx // 2
        sx = mx + 38 + col_idx * 640
        sy = my + 112 + row_idx * 282
        sw = 610
        sh = 264

        draw.rounded_rectangle([sx, sy, sx + sw, sy + sh], radius=12, fill=(248, 250, 252), outline=(226, 232, 240), width=1)
        draw.text((sx + 18, sy + 14), sec_title, fill=(30, 41, 59), font=f_sec)

        for r_i, (k_str, desc) in enumerate(rows):
            ry = sy + 50 + r_i * 41
            draw.text((sx + 18, ry + 4), desc, fill=(51, 65, 85), font=f_body)
            bbox = draw.textbbox((0, 0), k_str, font=f_kbd)
            kw = (bbox[2] - bbox[0]) + 24
            draw_badge_pill(
                draw,
                sx + sw - kw - 16,
                ry,
                k_str,
                (255, 255, 255),
                (15, 23, 42),
                f_kbd,
                pad_x=12,
                pad_y=4,
                radius=6,
                border_color=(203, 213, 225),
            )

    out_path = output_dir / "03_keyboard_shortcuts_1920x1080.png"
    img.save(out_path, format="PNG")
    print(f"Created {out_path}")


def create_screenshot_04_privacy_and_safety(output_dir: Path, icon_lg: Image.Image, icon_sm: Image.Image):
    """スクショ4: 2段階安全アーカイブ削除・日次バックアップ・プライバシー保護"""
    img = Image.new("RGB", (1920, 1080), (15, 23, 42))
    draw = ImageDraw.Draw(img)

    draw_promo_header(
        img,
        draw,
        icon_lg,
        "FEATURE 04  |  DATA SAFETY & COMPLETE PRIVACY",
        "外部通信ゼロ・2段階アーカイブ削除・日次バックアップでデータを保護",
        "誤操作によるデータ消失を防ぐ「アーカイブ⇒完全削除」の2段階保護と、起動時のSQLiteオンラインバックアップ（7世代保持）",
        ["◆ 誤削除を防ぐ2段階アーカイブ", "◆ 自動7世代バックアップ", "◆ 個人情報・テレメトリ収集ゼロ"],
    )

    wx, wy, ww, wh = 84, 178, 1752, 852
    draw.rounded_rectangle([wx - 2, wy - 2, wx + ww + 2, wy + wh + 2], radius=18, fill=(51, 65, 85))
    draw.rounded_rectangle([wx, wy, wx + ww, wy + wh], radius=16, fill=(241, 245, 249))
    body_y = draw_app_header_bar(img, draw, wx, wy, ww, icon_sm)

    f_h3 = get_font(20, bold=True)
    f_sec = get_font(15, bold=True)
    f_body = get_font(14)
    f_small = get_font(12, bold=True)

    ax, ay, aw, ah = wx + 36, body_y + 28, 840, 700
    draw.rounded_rectangle([ax, ay, ax + aw, ay + ah], radius=16, fill=(255, 255, 255), outline=(203, 213, 225), width=2)
    draw.text((ax + 28, ay + 24), "■ アーカイブ済みカード一覧（2段階安全削除）", fill=(15, 23, 42), font=f_h3)
    draw.text((ax + 28, ay + 56), "通常画面からはアーカイブのみ行われ、ここからいつでも元のリストへ復元または完全削除できます。", fill=(100, 116, 139), font=f_body)
    draw.line([(ax, ay + 88), (ax + aw, ay + 88)], fill=(226, 232, 240), width=1)

    archived_cards = [
        ("旧デザイン案の検討メモ", "元のリスト: ToDo（未着手）", "2026/10/16 アーカイブ"),
        ("2026年 Q3 振り返りタスクまとめ", "元のリスト: 完了 (Done)", "2026/10/15 アーカイブ"),
        ("テスト用ダミー画像添付カード", "元のリスト: 進行中 (In Progress)", "2026/10/14 アーカイブ"),
    ]
    for i, (c_title, orig_list, date_str) in enumerate(archived_cards):
        cy = ay + 110 + i * 118
        draw.rounded_rectangle([ax + 24, cy, ax + aw - 24, cy + 102], radius=12, fill=(248, 250, 252), outline=(226, 232, 240), width=1)
        draw.text((ax + 44, cy + 18), c_title, fill=(15, 23, 42), font=f_sec)
        draw.text((ax + 44, cy + 48), f"{orig_list}   |   {date_str}", fill=(100, 116, 139), font=f_small)
        draw_badge_pill(
            draw,
            ax + aw - 280,
            cy + 32,
            "↩ ボードへ復元",
            (238, 242, 255),
            (67, 56, 202),
            f_small,
            pad_x=14,
            pad_y=6,
            radius=8,
            border_color=(199, 210, 254),
        )
        draw_badge_pill(
            draw,
            ax + aw - 150,
            cy + 32,
            "× 完全削除",
            (255, 241, 242),
            (190, 18, 60),
            f_small,
            pad_x=14,
            pad_y=6,
            radius=8,
            border_color=(254, 205, 211),
        )

    draw.rounded_rectangle([ax + 24, ay + 480, ax + aw - 24, ay + ah - 24], radius=12, fill=(236, 253, 245), outline=(167, 243, 208), width=1)
    draw.text((ax + 44, ay + 500), "◆ リスト削除時の自動カード保護機能", fill=(6, 95, 70), font=f_sec)
    draw.text((ax + 44, ay + 532), "・リスト自体を削除しても、所属カードは消去されず自動的にアーカイブへ保護退避されます。", fill=(4, 120, 87), font=f_body)
    draw.text((ax + 44, ay + 562), "・完全削除を実行した場合のみ、SQLite レコードとディスク上の添付画像が物理削除されます。", fill=(4, 120, 87), font=f_body)
    draw.text((ax + 44, ay + 592), "・リアルタイム保存状態インジケーター（✓ 保存済み）により、保存完了を常時確認できます。", fill=(4, 120, 87), font=f_body)

    px, py, pw, ph = ax + aw + 28, body_y + 28, 812, 700
    draw.rounded_rectangle([px, py, px + pw, py + ph], radius=16, fill=(255, 255, 255), outline=(203, 213, 225), width=2)
    draw.text((px + 28, py + 24), "■ プライバシー保護 & ローカルデータ堅牢設計", fill=(15, 23, 42), font=f_h3)
    draw.text((px + 28, py + 56), "業務上の機密タスクや個人のプライベートな計画も、外部流出リスクゼロで安全に管理できます。", fill=(100, 116, 139), font=f_body)
    draw.line([(px, py + 88), (px + pw, py + 88)], fill=(226, 232, 240), width=1)

    pillars = [
        (
            "1. 外部通信・テレメトリ送信ゼロ（完全オフライン完結）",
            "Tauri v2 ネイティブ IPC によりすべての処理が PC 内で完結。アカウント登録・クラウド同期・トラッキング・広告は一切ありません。",
            (239, 246, 255),
            (30, 64, 175),
        ),
        (
            "2. 起動時の日次自動オンラインバックアップ（最新7世代保持）",
            "%APPDATA%\\LocalBan\\backups フォルダに SQLite Backup API を用いて起動時に自動バックアップを作成し、万一のトラブルにも備えます。",
            (236, 253, 245),
            (6, 95, 70),
        ),
        (
            "3. タスクトレイ常駐 & 選べる「×」ボタン動作（トレイ格納 / 完全終了）",
            "ヘッダーの「×: トレイ格納 / 完全終了」ボタンから閉じる動作をワンクリックで切替可能。単一インスタンス制御で多重起動も防止。",
            (245, 243, 255),
            (91, 33, 182),
        ),
        (
            "4. アプリ内からいつでも確認できるプライバシーポリシー・免責事項",
            "ヘッダーの「規約・免責」ボタンから、オフライン状態でもプライバシーポリシー全文・ライセンス・免責事項をいつでも確認できます。",
            (248, 250, 252),
            (51, 65, 85),
        ),
    ]
    for idx, (p_title, p_desc, bg_c, fg_c) in enumerate(pillars):
        by = py + 110 + idx * 140
        draw.rounded_rectangle([px + 24, by, px + pw - 24, by + 122], radius=12, fill=bg_c)
        draw.text((px + 44, by + 18), p_title, fill=fg_c, font=f_sec)
        draw.text((px + 44, by + 50), p_desc[:46], fill=(51, 65, 85), font=f_body)
        if len(p_desc) > 46:
            draw.text((px + 44, by + 76), p_desc[46:], fill=(51, 65, 85), font=f_body)

    out_path = output_dir / "04_privacy_and_safety_1920x1080.png"
    img.save(out_path, format="PNG")
    print(f"Created {out_path}")


def create_store_artworks(output_dir: Path):
    """ストアアートワーク3種 (16:9 Hero 1920x1080, 1:1 Box Art 1080x1080, 2:3 Poster Art 720x1080)"""
    master_icon = draw_localban_icon_master(1024)

    # 1. 16:9 Hero Banner (1920x1080)
    hero = Image.new("RGB", (1920, 1080), (15, 23, 42))
    h_draw = ImageDraw.Draw(hero)
    h_draw.ellipse([-250, -250, 950, 950], fill=(30, 41, 59))
    h_draw.ellipse([1050, 150, 2200, 1300], fill=(17, 34, 64))

    icon_320 = master_icon.resize((320, 320), Image.Resampling.LANCZOS)
    hero.paste(icon_320, (130, 210), icon_320)

    f_tag = get_font(18, bold=True)
    f_title = get_font(68, bold=True)
    f_sub = get_font(28, bold=True)
    f_desc = get_font(20)
    f_feat_title = get_font(24, bold=True)
    f_feat = get_font(18, bold=True)

    draw_badge_pill(
        h_draw,
        490,
        215,
        "WINDOWS 11 / 10 NATIVE DESKTOP APP",
        (16, 185, 129),
        (255, 255, 255),
        f_tag,
        pad_x=18,
        pad_y=6,
        radius=12,
    )
    h_draw.text((490, 270), "LocalBan", fill=(255, 255, 255), font=f_title)
    h_draw.text((490, 365), "軽量・オフラインファーストな個人用カンバンボード", fill=(56, 189, 248), font=f_sub)
    h_draw.text(
        (490, 420),
        "外部通信ゼロ・ログイン不要。Tauri v2 (Full Rust) + SQLite で爆速動作するタスク管理ツール",
        fill=(203, 213, 225),
        font=f_desc,
    )

    features = [
        ("◆ Full Rust & ネイティブ起動", "省メモリ・高速レスポンスでストレスフリー"),
        ("◆ フルキーボード操作対応", "c / Enter / 矢印キー / ? でマウスレス操作"),
        ("◆ GFM Markdown & ノート記法", "コード・表・:::note・Ctrl+V 画像貼付に対応"),
        ("◆ 完全ローカル保存 & 自動保護", "2段階アーカイブ削除 + 7世代自動バックアップ"),
    ]
    for i, (ft, fd) in enumerate(features):
        col = i % 2
        row = i // 2
        fx = 130 + col * 840
        fy = 590 + row * 185
        h_draw.rounded_rectangle([fx, fy, fx + 810, fy + 155], radius=18, fill=(30, 41, 59), outline=(51, 65, 85), width=2)
        h_draw.text((fx + 32, fy + 30), ft, fill=(52, 211, 153), font=f_feat_title)
        h_draw.text((fx + 32, fy + 82), fd, fill=(226, 232, 240), font=f_feat)

    hero.save(output_dir / "hero_banner_1920x1080.png", format="PNG")

    # 2. 1:1 Box Art (1080x1080)
    box = Image.new("RGB", (1080, 1080), (15, 23, 42))
    b_draw = ImageDraw.Draw(box)
    b_draw.ellipse([-150, -150, 750, 750], fill=(30, 41, 59))
    b_draw.rounded_rectangle([36, 36, 1044, 1044], radius=48, fill=(15, 23, 42), outline=(51, 65, 85), width=3)

    icon_420 = master_icon.resize((420, 420), Image.Resampling.LANCZOS)
    box.paste(icon_420, (330, 130), icon_420)

    f_b_title = get_font(64, bold=True)
    f_b_sub = get_font(26, bold=True)
    f_b_pill = get_font(18, bold=True)

    b_draw.text((540, 610), "LocalBan", fill=(255, 255, 255), font=f_b_title, anchor="mm")
    b_draw.text((540, 680), "オフラインファースト・個人用カンバンボード", fill=(52, 211, 153), font=f_b_sub, anchor="mm")

    draw_badge_pill(
        b_draw,
        140,
        760,
        "◆ Full Rust 高速動作",
        (30, 41, 59),
        (226, 232, 240),
        f_b_pill,
        pad_x=20,
        pad_y=10,
        radius=14,
        border_color=(51, 65, 85),
    )
    draw_badge_pill(
        b_draw,
        445,
        760,
        "◆ 外部通信ゼロ",
        (30, 41, 59),
        (226, 232, 240),
        f_b_pill,
        pad_x=20,
        pad_y=10,
        radius=14,
        border_color=(51, 65, 85),
    )
    draw_badge_pill(
        b_draw,
        695,
        760,
        "◆ Markdown対応",
        (30, 41, 59),
        (226, 232, 240),
        f_b_pill,
        pad_x=20,
        pad_y=10,
        radius=14,
        border_color=(51, 65, 85),
    )

    b_draw.text((540, 910), "Windows 11 / 10 Native Desktop Client", fill=(148, 163, 184), font=get_font(18), anchor="mm")
    box.save(output_dir / "box_art_1080x1080.png", format="PNG")

    # 3. 2:3 Poster Art (720x1080)
    poster = Image.new("RGB", (720, 1080), (15, 23, 42))
    p_draw = ImageDraw.Draw(poster)
    p_draw.ellipse([-120, -120, 600, 600], fill=(30, 41, 59))
    p_draw.rounded_rectangle([28, 28, 692, 1052], radius=36, fill=(15, 23, 42), outline=(51, 65, 85), width=3)

    icon_320_p = master_icon.resize((320, 320), Image.Resampling.LANCZOS)
    poster.paste(icon_320_p, (200, 110), icon_320_p)

    p_draw.text((360, 485), "LocalBan", fill=(255, 255, 255), font=get_font(54, bold=True), anchor="mm")
    p_draw.text((360, 548), "軽量・完全オフライン カンバンボード", fill=(52, 211, 153), font=get_font(22, bold=True), anchor="mm")

    p_list = [
        "✓ 認証不要・外部通信ゼロで安心",
        "✓ キーボード完結の高速カード操作",
        "✓ Markdown・ノート記法・画像貼付",
        "✓ 2段階安全削除 & 7世代自動保護",
    ]
    for idx, item in enumerate(p_list):
        py = 625 + idx * 72
        p_draw.rounded_rectangle([80, py, 640, py + 54], radius=12, fill=(30, 41, 59), outline=(51, 65, 85), width=1)
        p_draw.text((110, py + 13), item, fill=(241, 245, 249), font=get_font(18, bold=True))

    p_draw.text((360, 975), "Powered by Tauri v2 & Rust", fill=(148, 163, 184), font=get_font(16), anchor="mm")
    poster.save(output_dir / "poster_art_720x1080.png", format="PNG")
    print(f"Created 3 Store Artworks in {output_dir}")


if __name__ == "__main__":
    msix_dir = root_dir / "assets" / "store" / "msix_assets"
    promo_dir = root_dir / "assets" / "store" / "promotional"
    promo_dir.mkdir(parents=True, exist_ok=True)

    generate_msix_assets(msix_dir)

    master = draw_localban_icon_master(1024)
    icon_lg = master.resize((88, 88), Image.Resampling.LANCZOS)
    icon_sm = master.resize((32, 32), Image.Resampling.LANCZOS)

    create_screenshot_01_main_board(promo_dir, icon_lg, icon_sm)
    create_screenshot_02_card_detail(promo_dir, icon_lg, icon_sm)
    create_screenshot_03_keyboard_shortcuts(promo_dir, icon_lg, icon_sm)
    create_screenshot_04_privacy_and_safety(promo_dir, icon_lg, icon_sm)
    create_store_artworks(promo_dir)
    print("All Microsoft Store assets generated successfully!")
