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
        "v2.1.0",
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

    # Microsoft Store 表示用 300x300 アプリタイルアイコン
    tile_300 = master.resize((300, 300), Image.Resampling.LANCZOS)
    store_dir = output_dir.parent
    tile_300.save(store_dir / "app_tile_icon_300x300.png", format="PNG")
    tile_300.save(store_dir / "promotional" / "app_tile_icon_300x300.png", format="PNG")
    print(f"Generated 5 MSIX visual assets + 300x300 Store App Tile Icon in {output_dir}")


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
        "アカウント登録不要・外部通信ゼロで瞬時に起動し、ドラッグ＆ドロップで思考とタスクを直感整理",
        ["◆ 瞬時起動 & 軽快動作", "◆ 完全ローカル保存", "◆ カラーラベル & カバー画像"],
    )

    wx, wy, ww, wh = 84, 178, 1752, 852
    draw.rounded_rectangle([wx - 2, wy - 2, wx + ww + 2, wy + wh + 2], radius=18, fill=(51, 65, 85))
    draw.rounded_rectangle([wx, wy, wx + ww, wy + wh], radius=16, fill=(241, 245, 249))

    body_y = draw_app_header_bar(img, draw, wx, wy, ww, icon_sm)

    columns = [
        {
            "title": "ToDo",
            "count": "1",
            "cards": [
                {
                    "labels": [("アイデア", (16, 185, 129))],
                    "lines": ["LocalBanへようこそ！", "基本操作を試してみましょう"],
                    "due": None,
                    "check": "1/3",
                    "has_desc": True,
                    "selected": True,
                },
            ],
        },
        {
            "title": "進行中",
            "count": "1",
            "cards": [
                {
                    "labels": [("優先度: 中", (245, 158, 11))],
                    "lines": ["ドラッグ＆ドロップで", "カードを動かす"],
                    "due": None,
                    "check": "1/2",
                    "has_desc": True,
                    "selected": False,
                },
            ],
        },
        {
            "title": "完了",
            "count": "1",
            "cards": [
                {
                    "labels": [("優先度: 低", (14, 165, 233))],
                    "lines": ["完了したタスクを整理する"],
                    "due": None,
                    "check": "2/2",
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
    """スクショ2: カード詳細モーダル（文字装飾・チェックリスト・画像添付）"""
    img = Image.new("RGB", (1920, 1080), (15, 23, 42))
    draw = ImageDraw.Draw(img)

    draw_promo_header(
        img,
        draw,
        icon_lg,
        "FEATURE 02  |  RICH CARD DETAILS & CHECKLIST",
        "文字装飾・チェックリスト・画像貼り付けを1枚に凝縮",
        "見出し・箇条書き・表・強調装飾、Ctrl+V クリップボード画像貼付、進捗バー付きチェックリストに対応",
        ["◆ リッチな文字装飾プレビュー", "◆ Ctrl+V 画像直接貼付", "◆ 進捗バー付きチェックリスト"],
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

    draw.text((mx + 36, my + 26), "LocalBanへようこそ！ 基本操作を試してみましょう", fill=(15, 23, 42), font=f_h2)
    draw.text(
        (mx + 36, my + 58),
        "リスト: ToDo   |   ショートカット: [e] 説明編集  [d] 期限設定  [t] チェックリスト追加",
        fill=(100, 116, 139),
        font=f_small,
    )

    draw_badge_pill(draw, mx + 36, my + 88, "アイデア", (16, 185, 129), (255, 255, 255), f_small, pad_x=14, pad_y=4, radius=6)

    lx = mx + 36
    ly = my + 134
    lw = 860
    draw.text((lx, ly), "■ 説明 (マークダウン装飾プレビュー)", fill=(30, 41, 59), font=f_sec)
    draw_badge_pill(draw, lx + lw - 150, ly - 4, "編集 [e] / Ctrl+Shift+P", (241, 245, 249), (71, 85, 105), f_small, pad_x=10, pad_y=3, radius=6)

    draw.rounded_rectangle([lx, ly + 30, lx + lw, ly + 240], radius=12, fill=(248, 250, 252), outline=(226, 232, 240), width=1)
    draw.text((lx + 24, ly + 48), "LocalBan はローカル環境で動作するシンプルなカンバンボードです。", fill=(30, 41, 59), font=f_body)
    draw.text((lx + 24, ly + 80), "基本操作:", fill=(15, 23, 42), font=f_sec)
    draw.text((lx + 24, ly + 108), "・ カードをクリックすると詳細画面が開き、説明の編集やチェックリストの作成ができます", fill=(51, 65, 85), font=f_body)
    draw.text((lx + 24, ly + 136), "・ カードをドラッグ＆ドロップして、右側の「進行中」や「完了」リストへ移動できます", fill=(51, 65, 85), font=f_body)
    draw.text((lx + 24, ly + 164), "・ リスト下部の「+ カードを追加」から新しいカードを作成できます", fill=(51, 65, 85), font=f_body)

    cly = ly + 265
    draw.text((lx, cly), "■ はじめてのステップ (チェックリスト)", fill=(30, 41, 59), font=f_sec)
    draw.text((lx + lw - 100, cly), "1 / 3 (33%)", fill=(16, 185, 129), font=f_sec)
    draw.rounded_rectangle([lx, cly + 28, lx + lw, cly + 38], radius=5, fill=(226, 232, 240))
    draw.rounded_rectangle([lx, cly + 28, lx + int(lw * 0.33), cly + 38], radius=5, fill=(16, 185, 129))

    items = [
        (True, "このカードをクリックして詳細を開く"),
        (False, "カードをドラッグして「進行中」へ移動する"),
        (False, "新しいカードを自分で作成してみる"),
    ]
    for i, (done, text) in enumerate(items):
        iy = cly + 52 + i * 40
        box_col = (16, 185, 129) if done else (255, 255, 255)
        border_col = (16, 185, 129) if done else (148, 163, 184)
        draw.rounded_rectangle([lx + 8, iy, lx + 30, iy + 22], radius=5, fill=box_col, outline=border_col, width=2)
        if done:
            draw.text((lx + 12, iy - 1), "✓", fill=(255, 255, 255), font=f_small)
        txt_col = (148, 163, 184) if done else (30, 41, 59)
        draw.text((lx + 42, iy + 1), text, fill=txt_col, font=f_body)

    rx = lx + lw + 36
    rw = 440
    draw.text((rx, ly), "■ 添付ファイル (ドラッグ＆ドロップ / Ctrl+V)", fill=(30, 41, 59), font=f_sec)
    draw.rounded_rectangle([rx, ly + 30, rx + rw, ly + 180], radius=12, fill=(248, 250, 252), outline=(203, 213, 225), width=1)
    draw.text((rx + 24, ly + 65), "＋ 画像やファイルをドラッグ＆ドロップ", fill=(71, 85, 105), font=f_body)
    draw.text((rx + 24, ly + 95), "またはクリップボードから [Ctrl + V] で直接貼り付け", fill=(100, 116, 139), font=f_small)
    draw.text((rx + 24, ly + 125), "最大 50MB までのファイルをローカル保存", fill=(148, 163, 184), font=f_small)

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
        "誤操作によるデータ消失を防ぐ「アーカイブ⇒完全削除」の2段階保護と、起動時の自動安全バックアップ（7世代保持）",
        ["◆ 誤削除を防ぐ2段階アーカイブ", "◆ 自動7世代バックアップ", "◆ 個人情報・外部送信ゼロ"],
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
        ("旧デザイン案の検討メモ", "元のリスト: ToDo", "2026/10/16 アーカイブ"),
        ("2026年 Q3 振り返りタスクまとめ", "元のリスト: 完了", "2026/10/15 アーカイブ"),
        ("テスト用ダミー画像添付カード", "元のリスト: 進行中", "2026/10/14 アーカイブ"),
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
    draw.text((ax + 44, ay + 562), "・完全削除を実行した場合のみ、データとディスク上の添付画像が物理削除されます。", fill=(4, 120, 87), font=f_body)
    draw.text((ax + 44, ay + 592), "・リアルタイム保存状態インジケーター（✓ 保存済み）により、保存完了を常時確認できます。", fill=(4, 120, 87), font=f_body)

    px, py, pw, ph = ax + aw + 28, body_y + 28, 812, 700
    draw.rounded_rectangle([px, py, px + pw, py + ph], radius=16, fill=(255, 255, 255), outline=(203, 213, 225), width=2)
    draw.text((px + 28, py + 24), "■ プライバシー保護 & ローカルデータ堅牢設計", fill=(15, 23, 42), font=f_h3)
    draw.text((px + 28, py + 56), "業務上の機密タスクや個人のプライベートな計画も、外部流出リスクゼロで安全に管理できます。", fill=(100, 116, 139), font=f_body)
    draw.line([(px, py + 88), (px + pw, py + 88)], fill=(226, 232, 240), width=1)

    pillars = [
        (
            "1. 外部通信・データ送信ゼロ（完全オフライン完結）",
            "すべての処理がお使いの PC 内だけで完結。アカウント登録・クラウド同期・トラッキング・広告は一切ありません。",
            (239, 246, 255),
            (30, 64, 175),
        ),
        (
            "2. 起動時の自動バックアップ（最新7世代を自動保護）",
            "ローカルPCの専用フォルダに起動時自動で安全なスナップショットを作成し、万一のトラブルや誤操作にも備えます。",
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
        "WINDOWS 11 / 10 DESKTOP APP",
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
        "外部通信ゼロ・ログイン不要。PCに負担をかけず超軽量・爆速動作する個人向けタスク管理ツール",
        fill=(203, 213, 225),
        font=f_desc,
    )

    features = [
        ("◆ かんばん タスク管理（個人向け）", "ドラッグ＆ドロップで思考を整理。Markdown・進捗付きチェックリスト対応"),
        ("◆ 完全オフライン動作 & 情報収集なし", "外部通信ゼロ・広告/トラッキング一切なし。データはすべてローカルPCに安全保存"),
        ("◆ アカウント作成不要で即座に開始", "登録やログインの手間なし。インストールして開くだけであなた専用ボードが利用可能"),
        ("◆ 超軽量・瞬時起動の高速設計", "PCに負担をかけない省メモリ設計。キーボード完結の爆速操作に対応"),
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

    # 2. 1:1 Box Art / Store Logo (2160x2160 & 1080x1080)
    # 2160x2160 高解像度 Microsoft Store アプリロゴ / スクエアアート
    box_2160 = Image.new("RGB", (2160, 2160), (15, 23, 42))
    b2_draw = ImageDraw.Draw(box_2160)
    b2_draw.ellipse([-300, -300, 1500, 1500], fill=(30, 41, 59))
    b2_draw.ellipse([1100, 300, 2600, 1800], fill=(17, 34, 64))
    b2_draw.ellipse([500, 1300, 1800, 2600], fill=(13, 30, 45))
    b2_draw.rounded_rectangle([64, 64, 2096, 2096], radius=80, fill=(15, 23, 42), outline=(51, 65, 85), width=4)

    icon_880 = master_icon.resize((880, 880), Image.Resampling.LANCZOS)
    box_2160.paste(icon_880, (640, 220), icon_880)

    f_b2_title = get_font(128, bold=True)
    f_b2_sub = get_font(48, bold=True)
    f_b2_pill = get_font(28, bold=True)

    b2_draw.text((1080, 1220), "LocalBan", fill=(255, 255, 255), font=f_b2_title, anchor="mm")
    b2_draw.text((1080, 1340), "オフラインファースト・個人用カンバンボード", fill=(52, 211, 153), font=f_b2_sub, anchor="mm")

    pills_2160 = [
        ("◆ 完全オフライン・外部通信ゼロ", 220, 1470),
        ("◆ アカウント登録不要・今すぐ開始", 1110, 1470),
        ("◆ 超軽量・瞬時起動の快適操作", 220, 1620),
        ("◆ 直感的なかんばん & Markdown", 1110, 1620),
    ]
    for p_txt, px, py in pills_2160:
        b2_draw.rounded_rectangle([px, py, px + 830, py + 110], radius=24, fill=(30, 41, 59), outline=(51, 65, 85), width=2)
        b2_draw.text((px + 40, py + 34), p_txt, fill=(226, 232, 240), font=f_b2_pill)

    b2_draw.text((1080, 1860), "Windows 11 / 10 専用 デスクトップ アプリケーション", fill=(148, 163, 184), font=get_font(34), anchor="mm")
    b2_draw.text((1080, 1920), "Offline-First Personal Kanban Board", fill=(100, 116, 139), font=get_font(26), anchor="mm")

    # 保存: 2160x2160
    store_dir = output_dir.parent
    box_2160.save(output_dir / "microsoft_store_logo_2160x2160.png", format="PNG")
    box_2160.save(output_dir / "box_art_2160x2160.png", format="PNG")
    box_2160.save(store_dir / "microsoft_store_logo_2160x2160.png", format="PNG")

    # 1080x1080 互換リサイズ
    box_1080 = box_2160.resize((1080, 1080), Image.Resampling.LANCZOS)
    box_1080.save(output_dir / "box_art_1080x1080.png", format="PNG")

    # クリーン版ロゴ (2160x2160)
    clean_2160 = Image.new("RGB", (2160, 2160), (15, 23, 42))
    c_draw = ImageDraw.Draw(clean_2160)
    c_draw.ellipse([-200, -200, 1200, 1200], fill=(30, 41, 59))
    c_draw.ellipse([1200, 500, 2500, 1800], fill=(17, 34, 64))
    icon_1080 = master_icon.resize((1080, 1080), Image.Resampling.LANCZOS)
    clean_2160.paste(icon_1080, (540, 300), icon_1080)
    c_draw.text((1080, 1530), "LocalBan", fill=(255, 255, 255), font=get_font(150, bold=True), anchor="mm")
    c_draw.text((1080, 1670), "Offline Kanban Board", fill=(52, 211, 153), font=get_font(52, bold=True), anchor="mm")
    clean_2160.save(output_dir / "app_logo_clean_2160x2160.png", format="PNG")
    clean_2160.save(store_dir / "app_logo_clean_2160x2160.png", format="PNG")

    # 3. 2:3 Poster Art / Store Logo (1440x2160 & 720x1080)
    poster_1440 = Image.new("RGB", (1440, 2160), (15, 23, 42))
    p2_draw = ImageDraw.Draw(poster_1440)
    p2_draw.ellipse([-240, -240, 1200, 1200], fill=(30, 41, 59))
    p2_draw.ellipse([600, 400, 1800, 1600], fill=(17, 34, 64))
    p2_draw.rounded_rectangle([52, 52, 1388, 2108], radius=64, fill=(15, 23, 42), outline=(51, 65, 85), width=4)

    icon_640 = master_icon.resize((640, 640), Image.Resampling.LANCZOS)
    poster_1440.paste(icon_640, (400, 220), icon_640)

    p2_draw.text((720, 970), "LocalBan", fill=(255, 255, 255), font=get_font(108, bold=True), anchor="mm")
    p2_draw.text((720, 1070), "軽量・完全オフライン カンバンボード", fill=(52, 211, 153), font=get_font(42, bold=True), anchor="mm")
    p2_draw.text((720, 1135), "Offline-First Personal Kanban", fill=(148, 163, 184), font=get_font(28), anchor="mm")

    poster_items = [
        ("✓ 完全オフライン・外部通信ゼロ", "トラッキング一切なし。データはすべてお使いのPC内に安全保管"),
        ("✓ アカウント登録不要・今すぐ開始", "サインアップやログイン不要。起動するだけですぐに利用可能"),
        ("✓ 超軽量・瞬時起動の快適操作", "PCに負担をかけない軽快動作。キーボード完結の操作に対応"),
        ("✓ 直感的なタスク整理 & ノート", "ドラッグ＆ドロップ・Markdown記法・多世代自動バックアップ"),
    ]
    for idx, (p_head, p_sub_txt) in enumerate(poster_items):
        cy = 1230 + idx * 155
        p2_draw.rounded_rectangle([110, cy, 1330, cy + 130], radius=20, fill=(30, 41, 59), outline=(51, 65, 85), width=2)
        p2_draw.text((146, cy + 24), p_head, fill=(241, 245, 249), font=get_font(30, bold=True))
        p2_draw.text((146, cy + 74), p_sub_txt, fill=(148, 163, 184), font=get_font(20))

    p2_draw.text((720, 1960), "Windows 11 / 10 専用 デスクトップ アプリケーション", fill=(100, 116, 139), font=get_font(28), anchor="mm")

    # 保存: 1440x2160
    poster_1440.save(output_dir / "microsoft_store_logo_1440x2160.png", format="PNG")
    poster_1440.save(output_dir / "poster_art_1440x2160.png", format="PNG")
    poster_1440.save(store_dir / "microsoft_store_logo_1440x2160.png", format="PNG")

    # 720x1080 互換リサイズ
    poster_720 = poster_1440.resize((720, 1080), Image.Resampling.LANCZOS)
    poster_720.save(output_dir / "poster_art_720x1080.png", format="PNG")
    print(f"Generated Microsoft Store logos (2160x2160 & 1440x2160) and artworks in {output_dir}")
def create_promo_features_overview(output_dir: Path, master_icon: Image.Image):
    """プロモーション画像1: 「何ができるのか」4大コアバリュー徹底解説 (1920x1080)"""
    img = Image.new("RGB", (1920, 1080), (15, 23, 42))
    draw = ImageDraw.Draw(img)

    # 背景アンビエントグラデーション光彩
    draw.ellipse([-200, -200, 800, 800], fill=(30, 41, 59))
    draw.ellipse([1100, -150, 2100, 750], fill=(17, 34, 64))
    draw.ellipse([500, 600, 1500, 1300], fill=(13, 30, 45))

    # 上部ヘッダー (y: 40〜190)
    icon_100 = master_icon.resize((104, 104), Image.Resampling.LANCZOS)
    img.paste(icon_100, (80, 48), icon_100)

    f_tag = get_font(15, bold=True)
    f_h1 = get_font(38, bold=True)
    f_sub = get_font(18)
    f_pill = get_font(14, bold=True)

    draw_badge_pill(
        draw,
        210,
        46,
        "WINDOWS 11 / 10 向け 個人専用オフライン カンバンボード",
        (16, 185, 129),
        (255, 255, 255),
        f_tag,
        pad_x=16,
        pad_y=5,
        radius=10,
    )
    draw.text((210, 84), "LocalBan で「何ができるのか」 — 4つの強力なコアバリュー", fill=(255, 255, 255), font=f_h1)
    draw.text(
        (212, 138),
        "外部通信ゼロ・アカウント不要・爆速起動。あなたの思考とタスクを手元だけで最速・安全に整理します。",
        fill=(148, 163, 184),
        font=f_sub,
    )

    # ヘッダー右側のクイックバッジ
    top_pills = ["◆ 完全オフライン", "◆ アカウント不要", "◆ 瞬時起動 & 軽快", "◆ 個人向け"]
    rx = 1920 - 80
    for p_txt in reversed(top_pills):
        bbox = draw.textbbox((0, 0), p_txt, font=f_pill)
        pw = (bbox[2] - bbox[0]) + 30
        rx -= pw
        draw_badge_pill(draw, rx, 65, p_txt, (30, 41, 59), (56, 189, 248), f_pill, pad_x=14, pad_y=6, radius=10, border_color=(51, 65, 85))
        rx -= 12

    # 4つのフィーチャーカード (2x2 グリッド)
    cards_data = [
        {
            "tag": "01 | かんばん タスク管理（個人向け）",
            "tag_bg": (6, 95, 70),
            "tag_fg": (52, 211, 153),
            "title": "直感的なドラッグ＆ドロップでタスクを可視化",
            "desc": "個人作業に最適化されたシンプルな3カラム構成。思考の流れを止めずにタスクを整理できます。",
            "points": [
                "ToDo・進行中・完了 の直感的なカンバン方式で進捗を一目で把握",
                "進捗バー付きチェックリストで細かな作業ステップも確実に管理 (✓ 1/3)",
                "6色のカラーラベルで優先度やカテゴリ（重要・アイデア等）を柔軟に色分け",
                "見出し・表・箇条書きのリッチな文字装飾 ＆ [Ctrl+V] 画像直接貼付",
            ],
            "accent": (16, 185, 129),
        },
        {
            "tag": "02 | 完全オフライン動作 & 情報収集なし",
            "tag_bg": (30, 58, 138),
            "tag_fg": (96, 165, 250),
            "title": "外部通信ゼロ。機密タスクもローカルで完全保護",
            "desc": "ネットワーク接続を一切必要とせず、すべてのデータはあなたのお手元のPC内だけに保存されます。",
            "points": [
                "タスク・チェックリスト・添付画像はすべてお使いのPC内に安全保存",
                "テレメトリ・トラッキング・広告・個人情報収集は完全にゼロで安心",
                "社内LAN・機密プロジェクト・インターネット遮断環境でも 100% 同一動作",
                "起動時 7世代自動ローカルバックアップ＆手動スナップショットでデータ消失を防止",
            ],
            "accent": (59, 130, 246),
        },
        {
            "tag": "03 | アカウント作成不要・ログイン不要",
            "tag_bg": (88, 28, 135),
            "tag_fg": (192, 132, 252),
            "title": "面倒な登録ゼロ。インストールして1秒で作業開始",
            "desc": "メールアドレスの登録やパスワード管理、認証メール待ちは不要。思い立ったらすぐ使えます。",
            "points": [
                "ユーザー登録やクラウドログインの手間なく、アプリ起動と同時に即利用可能",
                "チーム共有の権限管理や不要な通知に煩わされず、自分のタスクに深く没頭",
                "ワンクリックでタスクトレイ常駐・完全終了をいつでも柔軟に切替可能",
                "完全スタンドアロンで動作するため、アカウント停止やサービス終了の心配なし",
            ],
            "accent": (168, 85, 247),
        },
        {
            "tag": "04 | 高速起動 & PCにやさしい超軽量設計",
            "tag_bg": (120, 53, 15),
            "tag_fg": (251, 191, 36),
            "title": "クリックした瞬間に起動。驚くほど軽快な動作",
            "desc": "PCに負担をかけない超軽量設計。ストレスフリーな爆速レスポンスを実現。",
            "points": [
                "省メモリで常にバックグラウンド待機可能。クリックした瞬間に高速起動",
                "マウスを使わず作業できるフルキーボード操作（c / 1〜9 / Enter / 矢印 / ?）",
                "カードの連続作成（Enter）や保存して詳細展開（Shift+Enter）で思考速度を維持",
                "日本語入力の変換状態を自動検知する IME ガード完備で、誤作動を完全に防止",
            ],
            "accent": (245, 158, 11),
        },
    ]

    card_w = 850
    card_h = 390
    f_card_tag = get_font(13, bold=True)
    f_card_title = get_font(21, bold=True)
    f_card_sub = get_font(14)
    f_point = get_font(14)

    for i, c in enumerate(cards_data):
        col = i % 2
        row = i // 2
        cx = 80 + col * 910
        cy = 200 + row * 420

        # カード外枠
        draw.rounded_rectangle(
            [cx, cy, cx + card_w, cy + card_h],
            radius=18,
            fill=(30, 41, 59),
            outline=(51, 65, 85),
            width=2,
        )

        # 上部アクセントライン
        draw.rounded_rectangle([cx + 24, cy + 2, cx + card_w - 24, cy + 5], radius=2, fill=c["accent"])

        # タグ
        draw_badge_pill(draw, cx + 28, cy + 24, c["tag"], c["tag_bg"], c["tag_fg"], f_card_tag, pad_x=12, pad_y=4, radius=8)

        # 見出し & 概要
        draw.text((cx + 28, cy + 62), c["title"], fill=(255, 255, 255), font=f_card_title)
        draw.text((cx + 28, cy + 96), c["desc"], fill=(148, 163, 184), font=f_card_sub)

        # 区切り線
        draw.line([(cx + 28, cy + 126), (cx + card_w - 28, cy + 126)], fill=(51, 65, 85), width=1)

        # ポイント 4 項目
        for p_idx, pt in enumerate(c["points"]):
            py = cy + 144 + p_idx * 54
            draw.rounded_rectangle([cx + 28, py, cx + card_w - 28, py + 44], radius=8, fill=(15, 23, 42), outline=(30, 41, 59), width=1)
            # 先頭チェックアイコン風マーク
            draw.text((cx + 42, py + 12), "✓", fill=c["accent"], font=get_font(14, bold=True))
            draw.text((cx + 66, py + 12), pt, fill=(226, 232, 240), font=f_point)

    out_path = output_dir / "promo_features_overview_1920x1080.png"
    img.save(out_path, format="PNG")
    print(f"Created {out_path}")


def create_promo_showcase(output_dir: Path, master_icon: Image.Image, icon_sm: Image.Image):
    """プロモーション画像2: 実際のカンバンUIモックアップ ＋ 4大セールスポイント (1920x1080)"""
    img = Image.new("RGB", (1920, 1080), (15, 23, 42))
    draw = ImageDraw.Draw(img)

    draw.ellipse([-200, -200, 800, 800], fill=(30, 41, 59))
    draw.ellipse([1100, -150, 2100, 750], fill=(17, 34, 64))

    # 左側: 4大強みとキャッチコピー (幅 720px)
    icon_96 = master_icon.resize((96, 96), Image.Resampling.LANCZOS)
    img.paste(icon_96, (70, 70), icon_96)

    f_title = get_font(56, bold=True)
    f_sub = get_font(24, bold=True)
    f_badge = get_font(14, bold=True)
    f_desc = get_font(17)

    draw_badge_pill(draw, 185, 75, "WINDOWS 11 / 10 DESKTOP APP", (16, 185, 129), (255, 255, 255), f_badge, pad_x=14, pad_y=4, radius=8)
    draw.text((185, 110), "LocalBan", fill=(255, 255, 255), font=f_title)
    draw.text((70, 190), "個人作業を最速化する、オフライン・カンバン", fill=(56, 189, 248), font=f_sub)
    draw.text(
        (70, 232),
        "外部通信ゼロ・アカウント不要。起動したその瞬間から、\nあなただけのタスク管理が始まります。",
        fill=(203, 213, 225),
        font=f_desc,
    )

    pillars = [
        (
            "1. かんばん タスク管理（個人向け）",
            "ドラッグ＆ドロップで思考を整理。ToDo・進行中・完了をスムーズに可視化。進捗付きチェックリスト・Markdown対応。",
            (16, 185, 129),
        ),
        (
            "2. 完全オフライン動作 & 情報収集なし",
            "外部通信ゼロ・広告/トラッキング一切なし。タスクデータはお手元のPC内だけに安全保存。",
            (59, 130, 246),
        ),
        (
            "3. アカウント作成不要・すぐ使える",
            "面倒な会員登録やログインの手間は一切不要。アプリを立ち上げれば1秒であなた専用ボードが開きます。",
            (168, 85, 247),
        ),
        (
            "4. 超軽量・一瞬で立ち上がる高速起動",
            "PCに負担をかけず爆速レスポンス。フルキーボード操作対応（c / 1〜9 / Enter / ?）でマウスレスの高速入力を実現。",
            (245, 158, 11),
        ),
    ]

    for idx, (p_t, p_d, p_col) in enumerate(pillars):
        py = 315 + idx * 175
        draw.rounded_rectangle([70, py, 720, py + 155], radius=16, fill=(30, 41, 59), outline=(51, 65, 85), width=2)
        draw.rounded_rectangle([70, py + 18, 76, py + 137], radius=3, fill=p_col)
        draw.text((96, py + 22), p_t, fill=(255, 255, 255), font=get_font(20, bold=True))
        draw.text((96, py + 60), p_d[:34], fill=(203, 213, 225), font=get_font(14))
        if len(p_d) > 34:
            draw.text((96, py + 86), p_d[34:68], fill=(203, 213, 225), font=get_font(14))
        if len(p_d) > 68:
            draw.text((96, py + 112), p_d[68:], fill=(148, 163, 184), font=get_font(13))

    # 右側: 実際のカンバンボード ウィンドウモックアップ (x: 770, y: 70, 幅 1080, 高さ 940)
    wx, wy, ww, wh = 770, 70, 1080, 940
    # 外周ドロップシャドウ風ボーダー
    draw.rounded_rectangle([wx - 4, wy - 4, wx + ww + 4, wy + wh + 4], radius=20, fill=(51, 65, 85))
    draw.rounded_rectangle([wx, wy, wx + ww, wy + wh], radius=18, fill=(241, 245, 249))

    # タイトルバー
    draw.rounded_rectangle([wx, wy, wx + ww, wy + 38], radius=18, fill=(241, 245, 249))
    draw.rectangle([wx, wy + 20, wx + ww, wy + 38], fill=(241, 245, 249))
    draw.text((wx + 18, wy + 10), "LocalBan - [個人専用オフラインボード]", fill=(71, 85, 105), font=get_font(12))
    draw.text((wx + ww - 95, wy + 9), "─   □   ×", fill=(100, 116, 139), font=get_font(12))

    # ヘッダーバー
    hy = wy + 38
    draw.rectangle([wx, hy, wx + ww, hy + 54], fill=(255, 255, 255))
    draw.line([(wx, hy + 54), (wx + ww, hy + 54)], fill=(226, 232, 240), width=1)
    img.paste(icon_sm, (wx + 18, hy + 11), icon_sm)
    draw.text((wx + 56, hy + 14), "LocalBan", fill=(15, 23, 42), font=get_font(18, bold=True))
    draw_badge_pill(draw, wx + 150, hy + 15, "v2.1.0", (236, 253, 245), (4, 120, 87), get_font(11, bold=True), pad_x=8, pad_y=3, radius=6)
    draw_badge_pill(draw, wx + 210, hy + 15, "オフライン", (241, 245, 249), (100, 116, 139), get_font(11, bold=True), pad_x=10, pad_y=3, radius=10)
    draw_badge_pill(draw, wx + 310, hy + 14, "✓ 保存済み", (236, 253, 245), (5, 150, 105), get_font(12, bold=True), pad_x=12, pad_y=4, radius=10)

    # 3カラム描画
    m_cols = [
        ("ToDo", "1", [
            ("アイデア", (16, 185, 129)),
            "LocalBanへようこそ！ 基本操作を試す",
            "✓ 1/3 (クリックして詳細展開)",
            True,
        ]),
        ("進行中", "1", [
            ("優先度: 中", (245, 158, 11)),
            "ドラッグ＆ドロップでカードを動かす",
            "✓ 1/2 (上下・左右にスムーズ移動)",
            False,
        ]),
        ("完了", "1", [
            ("優先度: 低", (14, 165, 233)),
            "完了したタスクを整理する",
            "✓ 2/2 (アーカイブで常時すっきり)",
            False,
        ]),
    ]
    mc_w = 328
    mc_gap = 18
    mc_start_x = wx + 22
    mc_y = hy + 72
    mc_h = 745

    for c_i, (c_title, c_cnt, c_data) in enumerate(m_cols):
        ccx = mc_start_x + c_i * (mc_w + mc_gap)
        draw.rounded_rectangle([ccx, mc_y, ccx + mc_w, mc_y + mc_h], radius=14, fill=(226, 232, 240), outline=(203, 213, 225), width=1)
        draw.text((ccx + 16, mc_y + 14), c_title, fill=(30, 41, 59), font=get_font(16, bold=True))
        draw_badge_pill(draw, ccx + mc_w - 50, mc_y + 12, c_cnt, (203, 213, 225), (51, 65, 85), get_font(11, bold=True), pad_x=8, pad_y=2, radius=8)

        # カード
        k_y = mc_y + 52
        k_h = 160
        (lbl_t, lbl_c), card_t, check_t, is_sel = c_data
        b_c = (79, 70, 229) if is_sel else (203, 213, 225)
        b_w = 2 if is_sel else 1
        draw.rounded_rectangle([ccx + 10, k_y, ccx + mc_w - 10, k_y + k_h], radius=10, fill=(255, 255, 255), outline=b_c, width=b_w)

        draw_badge_pill(draw, ccx + 20, k_y + 14, lbl_t, lbl_c, (255, 255, 255), get_font(11, bold=True), pad_x=8, pad_y=2, radius=6)
        draw.text((ccx + 20, k_y + 44), card_t[:17], fill=(15, 23, 42), font=get_font(14, bold=True))
        if len(card_t) > 17:
            draw.text((ccx + 20, k_y + 68), card_t[17:], fill=(15, 23, 42), font=get_font(14, bold=True))

        my = k_y + k_h - 32
        draw_badge_pill(draw, ccx + 20, my, check_t, (241, 245, 249), (5, 150, 105), get_font(11, bold=True), pad_x=8, pad_y=2, radius=6)

        draw.text((ccx + 16, mc_y + mc_h - 36), "＋ カードを追加 (c / 1〜3)", fill=(100, 116, 139), font=get_font(12))

    out_path = output_dir / "promo_showcase_1920x1080.png"
    img.save(out_path, format="PNG")
    print(f"Created {out_path}")


def draw_clean_base_board(img: Image.Image, draw: ImageDraw.ImageDraw, icon_sm: Image.Image):
    """1920x1080 フル画面の純粋な LocalBan メインボード描画（初回起動初期カード）"""
    # 1. Windows タイトルバー (0〜38)
    draw.rectangle([0, 0, 1920, 38], fill=(241, 245, 249))
    font_win = get_font(12)
    draw.text((18, 10), "LocalBan", fill=(71, 85, 105), font=font_win)
    draw.text((1920 - 110, 9), "─     □     ×", fill=(100, 116, 139), font=font_win)

    # 2. アプリヘッダー (38〜96)
    draw.rectangle([0, 38, 1920, 96], fill=(255, 255, 255))
    draw.line([(0, 96), (1920, 96)], fill=(226, 232, 240), width=1)

    img.paste(icon_sm, (22, 51), icon_sm)
    font_logo = get_font(21, bold=True)
    font_badge = get_font(12, bold=True)
    font_btn = get_font(13, bold=True)

    draw.text((64, 53), "LocalBan", fill=(15, 23, 42), font=font_logo)
    draw_badge_pill(draw, 172, 56, "v2.1.0", (236, 253, 245), (4, 120, 87), font_badge, pad_x=10, pad_y=4, radius=8, border_color=(167, 243, 208))
    draw_badge_pill(draw, 240, 56, "オフライン", (241, 245, 249), (100, 116, 139), font_badge, pad_x=12, pad_y=4, radius=12)

    cx = 1920 // 2 - 55
    draw_badge_pill(draw, cx, 54, "✓ 保存済み", (236, 253, 245), (5, 150, 105), font_btn, pad_x=14, pad_y=5, radius=14, border_color=(167, 243, 208))

    rx = 1920 - 640
    draw_badge_pill(draw, rx - 100, 53, "バックアップ", (241, 245, 249), (71, 85, 105), font_badge, pad_x=12, pad_y=6, radius=8)
    draw_badge_pill(draw, rx, 53, "×: トレイ格納", (238, 242, 255), (67, 56, 202), font_badge, pad_x=12, pad_y=6, radius=8, border_color=(199, 210, 254))
    draw_badge_pill(draw, rx + 122, 53, "ショートカット [?]", (241, 245, 249), (71, 85, 105), font_badge, pad_x=12, pad_y=6, radius=8)
    draw_badge_pill(draw, rx + 272, 53, "規約・免責", (241, 245, 249), (71, 85, 105), font_badge, pad_x=12, pad_y=6, radius=8)
    draw_badge_pill(draw, rx + 372, 53, "アーカイブ", (241, 245, 249), (51, 65, 85), font_badge, pad_x=12, pad_y=6, radius=8)
    draw_badge_pill(draw, rx + 468, 53, "終了", (255, 241, 242), (190, 18, 60), font_badge, pad_x=12, pad_y=6, radius=8, border_color=(254, 205, 211))

    # 3. ボードエリア (96〜1080)
    draw.rectangle([0, 97, 1920, 1080], fill=(241, 245, 249))

    columns = [
        {
            "title": "ToDo",
            "count": "1",
            "cards": [
                {
                    "labels": [("アイデア", (16, 185, 129))],
                    "lines": ["LocalBanへようこそ！ 基本操作を試してみましょう"],
                    "desc_preview": "LocalBan はローカル環境で動作するシンプルなカンバンボードです。カードをクリックして詳細を開き、ドラッグ＆ドロップで移動できます。",
                    "check": "1/3",
                    "selected": True,
                },
            ],
        },
        {
            "title": "進行中",
            "count": "1",
            "cards": [
                {
                    "labels": [("優先度: 中", (245, 158, 11))],
                    "lines": ["ドラッグ＆ドロップでカードを動かす"],
                    "desc_preview": "作業中のタスクは「進行中」リストに配置します。上下にドラッグして並び順変更、横にドラッグしてリスト間移動ができます。",
                    "check": "1/2",
                    "selected": False,
                },
            ],
        },
        {
            "title": "完了",
            "count": "1",
            "cards": [
                {
                    "labels": [("優先度: 低", (14, 165, 233))],
                    "lines": ["完了したタスクを整理する"],
                    "desc_preview": "終わったタスクは「完了」リストに移動して管理します。不要になったらアーカイブしてボードをすっきり整理できます。",
                    "check": "2/2",
                    "selected": False,
                },
            ],
        },
    ]

    f_col_title = get_font(18, bold=True)
    f_card_title = get_font(16, bold=True)
    f_card_desc = get_font(13)
    f_small = get_font(13, bold=True)
    f_meta = get_font(13)

    col_w = 440
    col_gap = 24
    start_x = 36
    col_y = 126
    ch = 920

    for idx, col in enumerate(columns):
        cx = start_x + idx * (col_w + col_gap)
        draw.rounded_rectangle([cx, col_y, cx + col_w, col_y + ch], radius=16, fill=(226, 232, 240), outline=(203, 213, 225), width=1)
        draw.text((cx + 20, col_y + 18), col["title"], fill=(30, 41, 59), font=f_col_title)
        draw_badge_pill(draw, cx + col_w - 65, col_y + 16, col["count"], (203, 213, 225), (51, 65, 85), f_small, pad_x=10, pad_y=3, radius=10)

        cy = col_y + 64
        for card in col["cards"]:
            card_h = 175
            border_c = (79, 70, 229) if card["selected"] else (203, 213, 225)
            border_w = 2 if card["selected"] else 1

            draw.rounded_rectangle([cx + 14, cy, cx + col_w - 14, cy + card_h], radius=12, fill=(255, 255, 255), outline=border_c, width=border_w)

            lx = cx + 28
            for l_name, l_col in card["labels"]:
                w_pill, _ = draw_badge_pill(draw, lx, cy + 16, l_name, l_col, (255, 255, 255), f_small, pad_x=10, pad_y=3, radius=6)
                lx += w_pill + 8

            for l_idx, line_str in enumerate(card["lines"]):
                draw.text((cx + 28, cy + 48 + l_idx * 24), line_str, fill=(15, 23, 42), font=f_card_title)

            if "desc_preview" in card:
                p_text = card["desc_preview"]
                draw.text((cx + 28, cy + 80), p_text[:28], fill=(100, 116, 139), font=f_card_desc)
                draw.text((cx + 28, cy + 102), p_text[28:56], fill=(100, 116, 139), font=f_card_desc)

            my = cy + card_h - 36
            mx = cx + 28
            if card["check"]:
                is_done = card["check"] == "2/2"
                c_bg = (209, 250, 229) if is_done else (241, 245, 249)
                c_fg = (5, 150, 105) if is_done else (71, 85, 105)
                pw, _ = draw_badge_pill(draw, mx, my, f"✓ {card['check']}", c_bg, c_fg, f_small, pad_x=9, pad_y=3, radius=6)
                mx += pw + 12

            draw.text((mx, my + 3), "≡ Markdown説明", fill=(100, 116, 139), font=f_meta)

            cy += card_h + 16

        draw.text((cx + 22, col_y + ch - 44), "＋ カードを追加  (ショートカット: c / 1〜3)", fill=(100, 116, 139), font=f_meta)

    add_x = start_x + 3 * (col_w + col_gap)
    draw.rounded_rectangle([add_x, col_y, add_x + 380, col_y + 60], radius=16, fill=(255, 255, 255), outline=(203, 213, 225), width=1)
    draw.text((add_x + 24, col_y + 19), "＋ もう1つリストを追加", fill=(71, 85, 105), font=f_col_title)


def create_clean_screenshots(output_dir: Path, icon_sm: Image.Image):
    """Windows ストア申請要件（1366x768以上）を満たす純粋な 1920x1080 実画面スクリーンショット 4枚"""
    output_dir.mkdir(parents=True, exist_ok=True)

    # 1. メインボード純粋画面 (1920x1080)
    img1 = Image.new("RGB", (1920, 1080), (241, 245, 249))
    draw1 = ImageDraw.Draw(img1)
    draw_clean_base_board(img1, draw1, icon_sm)
    out1 = output_dir / "01_main_board_1920x1080.png"
    img1.save(out1, format="PNG")
    print(f"Created clean screenshot: {out1}")

    # 2. 初期カード詳細モーダル純粋画面 (1920x1080)
    img2 = Image.new("RGB", (1920, 1080), (241, 245, 249))
    draw2 = ImageDraw.Draw(img2)
    draw_clean_base_board(img2, draw2, icon_sm)

    # モーダル背景オーバーレイ
    overlay = Image.new("RGBA", (1920, 1080), (15, 23, 42, 110))
    img2.paste(overlay, (0, 0), overlay)
    draw2 = ImageDraw.Draw(img2)

    mx, my, mw, mh = 220, 120, 1480, 840
    draw2.rounded_rectangle([mx, my, mx + mw, my + mh], radius=18, fill=(255, 255, 255), outline=(226, 232, 240), width=2)

    f_h2 = get_font(24, bold=True)
    f_sec = get_font(16, bold=True)
    f_body = get_font(15)
    f_small = get_font(13, bold=True)

    draw2.text((mx + 42, my + 32), "LocalBanへようこそ！ 基本操作を試してみましょう", fill=(15, 23, 42), font=f_h2)
    draw2.text(
        (mx + 42, my + 68),
        "リスト: ToDo   |   ショートカット: [e] 説明編集  [d] 期限設定  [t] チェックリスト追加",
        fill=(100, 116, 139),
        font=f_small,
    )

    draw_badge_pill(draw2, mx + 42, my + 102, "アイデア", (16, 185, 129), (255, 255, 255), f_small, pad_x=16, pad_y=5, radius=8)

    lx = mx + 42
    ly = my + 154
    lw = 900
    draw2.text((lx, ly), "■ 説明 (マークダウン装飾プレビュー)", fill=(30, 41, 59), font=f_sec)
    draw_badge_pill(draw2, lx + lw - 160, ly - 4, "編集 [e] / Ctrl+Shift+P", (241, 245, 249), (71, 85, 105), f_small, pad_x=10, pad_y=3, radius=6)

    draw2.rounded_rectangle([lx, ly + 32, lx + lw, ly + 310], radius=12, fill=(248, 250, 252), outline=(226, 232, 240), width=1)
    draw2.text((lx + 28, ly + 56), "LocalBan はローカル環境で動作するシンプルなカンバンボードです。", fill=(30, 41, 59), font=f_body)
    draw2.text((lx + 28, ly + 94), "基本操作:", fill=(15, 23, 42), font=f_sec)
    draw2.text((lx + 28, ly + 128), "・ カードをクリックすると詳細画面が開き、説明の編集やチェックリストの作成ができます", fill=(51, 65, 85), font=f_body)
    draw2.text((lx + 28, ly + 162), "・ カードをドラッグ＆ドロップして、右側の「進行中」や「完了」リストへ移動できます", fill=(51, 65, 85), font=f_body)
    draw2.text((lx + 28, ly + 196), "・ リスト下部の「+ カードを追加」から新しいカードを作成できます", fill=(51, 65, 85), font=f_body)

    cly = ly + 340
    draw2.text((lx, cly), "■ はじめてのステップ (チェックリスト)", fill=(30, 41, 59), font=f_sec)
    draw2.text((lx + lw - 110, cly), "1 / 3 (33%)", fill=(16, 185, 129), font=f_sec)
    draw2.rounded_rectangle([lx, cly + 30, lx + lw, cly + 42], radius=6, fill=(226, 232, 240))
    draw2.rounded_rectangle([lx, cly + 30, lx + int(lw * 0.33), cly + 42], radius=6, fill=(16, 185, 129))

    items = [
        (True, "このカードをクリックして詳細を開く"),
        (False, "カードをドラッグして「進行中」へ移動する"),
        (False, "新しいカードを自分で作成してみる"),
    ]
    for i, (done, text) in enumerate(items):
        iy = cly + 60 + i * 46
        box_col = (16, 185, 129) if done else (255, 255, 255)
        border_col = (16, 185, 129) if done else (148, 163, 184)
        draw2.rounded_rectangle([lx + 8, iy, lx + 34, iy + 26], radius=6, fill=box_col, outline=border_col, width=2)
        if done:
            draw2.text((lx + 13, iy - 1), "✓", fill=(255, 255, 255), font=f_small)
        txt_col = (148, 163, 184) if done else (30, 41, 59)
        draw2.text((lx + 48, iy + 2), text, fill=txt_col, font=f_body)

    rx = lx + lw + 42
    rw = 450
    draw2.text((rx, ly), "■ 添付ファイル (ドラッグ＆ドロップ / Ctrl+V)", fill=(30, 41, 59), font=f_sec)
    draw2.rounded_rectangle([rx, ly + 32, rx + rw, ly + 210], radius=12, fill=(248, 250, 252), outline=(203, 213, 225), width=1)
    draw2.text((rx + 28, ly + 72), "＋ 画像やファイルをドラッグ＆ドロップ", fill=(71, 85, 105), font=f_body)
    draw2.text((rx + 28, ly + 104), "またはクリップボードから [Ctrl + V] で直接貼り付け", fill=(100, 116, 139), font=f_small)
    draw2.text((rx + 28, ly + 136), "最大 50MB までのファイルをローカル保存", fill=(148, 163, 184), font=f_small)

    qy = ly + 265
    draw2.text((rx, qy), "■ カード操作・ショートカット", fill=(30, 41, 59), font=f_sec)
    actions = [
        ("▶ ラベルを編集", "6色のカラーラベルを割り当て"),
        ("▶ 期限 (Due Date) 設定 [d]", "日時ピッカーと4色ステータスバッジ"),
        ("▶ カードを複製 [c]", "チェックリスト・添付画像も丸ごと複製"),
        ("▶ アーカイブへ送る [a]", "誤削除を防ぐ2段階安全アーカイブ"),
    ]
    for idx, (act_t, act_sub) in enumerate(actions):
        ay = qy + 36 + idx * 68
        draw2.rounded_rectangle([rx, ay, rx + rw, ay + 56], radius=10, fill=(248, 250, 252), outline=(226, 232, 240), width=1)
        draw2.text((rx + 18, ay + 8), act_t, fill=(30, 41, 59), font=f_sec)
        draw2.text((rx + 18, ay + 32), act_sub, fill=(100, 116, 139), font=f_small)

    out2 = output_dir / "02_card_detail_1920x1080.png"
    img2.save(out2, format="PNG")
    print(f"Created clean screenshot: {out2}")

    # 3. ショートカットモーダル純粋画面 (1920x1080)
    img3 = Image.new("RGB", (1920, 1080), (241, 245, 249))
    draw3 = ImageDraw.Draw(img3)
    draw_clean_base_board(img3, draw3, icon_sm)
    img3.paste(overlay, (0, 0), overlay)
    draw3 = ImageDraw.Draw(img3)

    sx, sy, sw, sh = 280, 140, 1360, 800
    draw3.rounded_rectangle([sx, sy, sx + sw, sy + sh], radius=18, fill=(255, 255, 255), outline=(226, 232, 240), width=2)
    draw3.text((sx + 42, sy + 30), "■ キーボードショートカット一覧", fill=(15, 23, 42), font=f_h2)
    draw3.text((sx + 42, sy + 66), "すべてのショートカットは日本語入力（IME変換中）を自動検知し、誤動作を防止します。", fill=(100, 116, 139), font=f_body)
    draw3.line([(sx, sy + 100), (sx + sw, sy + 100)], fill=(226, 232, 240), width=1)

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
                ("e", "説明文（Markdown）の編集を開始"),
                ("Ctrl + Shift + P", "Markdown 編集 ⇄ プレビューをトグル切替"),
                ("Ctrl + Enter", "説明文の変更を保存"),
                ("d", "期限（Due Date）入力にフォーカス"),
                ("t / -", "チェックリストの新規作成を開始"),
                ("c / a", "カードを複製 / アーカイブへ移動"),
            ],
        ),
    ]

    sec_w = 400
    for col_i, (sec_title, sec_items) in enumerate(sections):
        s_cx = sx + 42 + col_i * (sec_w + 35)
        s_cy = sy + 125
        draw3.text((s_cx, s_cy), sec_title, fill=(30, 64, 175), font=f_sec)
        draw3.line([(s_cx, s_cy + 28), (s_cx + sec_w, s_cy + 28)], fill=(191, 219, 254), width=2)

        for item_i, (kbd_str, desc_str) in enumerate(sec_items):
            iy = s_cy + 42 + item_i * 68
            draw3.rounded_rectangle([s_cx, iy, s_cx + sec_w, iy + 58], radius=10, fill=(248, 250, 252), outline=(226, 232, 240), width=1)
            draw_badge_pill(draw3, s_cx + 12, iy + 14, kbd_str, (255, 255, 255), (15, 23, 42), get_font(13, bold=True), pad_x=10, pad_y=4, radius=6, border_color=(203, 213, 225))
            draw3.text((s_cx + 130, iy + 12), desc_str[:17], fill=(51, 65, 85), font=get_font(13))
            if len(desc_str) > 17:
                draw3.text((s_cx + 130, iy + 32), desc_str[17:], fill=(51, 65, 85), font=get_font(13))

    out3 = output_dir / "03_keyboard_shortcuts_1920x1080.png"
    img3.save(out3, format="PNG")
    print(f"Created clean screenshot: {out3}")

    # 4. 安全性・自動バックアップ純粋画面 (1920x1080)
    img4 = Image.new("RGB", (1920, 1080), (241, 245, 249))
    draw4 = ImageDraw.Draw(img4)
    draw_clean_base_board(img4, draw4, icon_sm)
    img4.paste(overlay, (0, 0), overlay)
    draw4 = ImageDraw.Draw(img4)

    px, py, pw, ph = 260, 130, 1400, 820
    draw4.rounded_rectangle([px, py, px + pw, py + ph], radius=18, fill=(255, 255, 255), outline=(226, 232, 240), width=2)
    draw4.text((px + 44, py + 30), "■ バックアップ & 完全ローカルデータ保護", fill=(15, 23, 42), font=f_h2)
    draw4.text((px + 44, py + 66), "LocalBan は完全オフライン。外部通信は一切行わず、大切なタスクデータを自動保護します。", fill=(100, 116, 139), font=f_body)
    draw4.line([(px, py + 100), (px + pw, py + 100)], fill=(226, 232, 240), width=1)

    pillars = [
        (
            "1. 完全オフライン & お手元のPC内だけに安全保存",
            "タスク・チェックリスト・添付画像はすべてお使いのPC内にのみ安全保存されます。外部サーバーへの通信は一切行われません。",
            (239, 246, 255),
            (30, 64, 175),
        ),
        (
            "2. 起動時 自動バックアップ（直近7世代をローカル保持）",
            "アプリ起動時にデータを安全にスナップショット保存。いつでも過去の世代へロールバック可能。誤操作やデータ消失から保護します。",
            (236, 253, 245),
            (4, 120, 87),
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
        by = py + 120 + idx * 160
        draw4.rounded_rectangle([px + 36, by, px + pw - 36, by + 138], radius=14, fill=bg_c)
        draw4.text((px + 60, by + 22), p_title, fill=fg_c, font=f_sec)
        draw4.text((px + 60, by + 60), p_desc[:52], fill=(51, 65, 85), font=f_body)
        if len(p_desc) > 52:
            draw4.text((px + 60, by + 90), p_desc[52:], fill=(51, 65, 85), font=f_body)

    out4 = output_dir / "04_privacy_and_safety_1920x1080.png"
    img4.save(out4, format="PNG")
    print(f"Created clean screenshot: {out4}")


if __name__ == "__main__":
    msix_dir = root_dir / "assets" / "store" / "msix_assets"
    promo_dir = root_dir / "assets" / "store" / "promotional"
    screenshots_dir = root_dir / "assets" / "store" / "screenshots"
    promo_dir.mkdir(parents=True, exist_ok=True)
    screenshots_dir.mkdir(parents=True, exist_ok=True)

    generate_msix_assets(msix_dir)

    master = draw_localban_icon_master(1024)
    icon_lg = master.resize((88, 88), Image.Resampling.LANCZOS)
    icon_sm = master.resize((32, 32), Image.Resampling.LANCZOS)

    # 1. プロモーションヘッダー付きスクリーンショット (1920x1080)
    create_screenshot_01_main_board(promo_dir, icon_lg, icon_sm)
    create_screenshot_02_card_detail(promo_dir, icon_lg, icon_sm)
    create_screenshot_03_keyboard_shortcuts(promo_dir, icon_lg, icon_sm)
    create_screenshot_04_privacy_and_safety(promo_dir, icon_lg, icon_sm)
    create_store_artworks(promo_dir)

    # 2. 「何ができるのか」特化プロモーション画像 (1920x1080)
    create_promo_features_overview(promo_dir, master)
    create_promo_showcase(promo_dir, master, icon_sm)

    # 3. 純粋な実機UIスクリーンショット (1920x1080)
    create_clean_screenshots(screenshots_dir, icon_sm)

    print("All Microsoft Store assets and screenshots generated successfully!")

