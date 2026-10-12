import subprocess
import sys
import shutil
import zipfile
import tomllib
from pathlib import Path

def run_command(cmd, cwd=None):
    print(f"==> Running: {cmd}")
    res = subprocess.run(cmd, shell=True, cwd=cwd)
    if res.returncode != 0:
        print(f"Error: Command failed with exit code {res.returncode}")
        sys.exit(res.returncode)

def get_app_version(root_dir: Path) -> str:
    pyproject_path = root_dir / "pyproject.toml"
    if pyproject_path.exists():
        try:
            with open(pyproject_path, "rb") as f:
                data = tomllib.load(f)
                return data.get("project", {}).get("version", "1.0.1")
        except Exception:
            pass
    return "1.0.1"

def create_dist_zip(root_dir: Path, exe_path: Path):
    # 最新の uninstall.bat を安全に再生成
    from scripts.build_uninstall_bat import generate as generate_uninstall_bat
    generate_uninstall_bat()

    version = get_app_version(root_dir)
    dist_dir = root_dir / "dist"
    zip_name = f"LocalBan-v{version}-windows.zip"
    zip_path = dist_dir / zip_name

    uninstall_bat = root_dir / "scripts" / "uninstall.bat"
    dist_readme = root_dir / "assets" / "dist_README.txt"
    license_file = root_dir / "LICENSE"
    notice_file = root_dir / "NOTICE.md"

    files_to_pack = [
        (exe_path, "LocalBan/LocalBan.exe"),
        (uninstall_bat, "LocalBan/uninstall.bat"),
        (dist_readme, "LocalBan/README.txt"),
        (license_file, "LocalBan/LICENSE"),
        (notice_file, "LocalBan/NOTICE.md"),
    ]

    print(f"\nPackaging ZIP: {zip_path}")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for src, arcname in files_to_pack:
            if src.exists():
                zf.write(src, arcname)
                print(f"  + Added: {arcname}")
            else:
                print(f"  ! Warning: {src} not found, skipped.")

    if zip_path.exists():
        zip_size_mb = zip_path.stat().st_size / (1024 * 1024)
        print(f"\n==========================================")
        print(f" ZIP PACKAGE CREATED!")
        print(f" Archive: {zip_path}")
        print(f" Size: {zip_size_mb:.2f} MB")
        print(f"==========================================")

def main():
    root_dir = Path(__file__).resolve().parent
    frontend_dir = root_dir / "frontend"
    assets_dir = root_dir / "assets"
    
    print("=== Step 1: Generating Icons ===")
    run_command(f'"{sys.executable}" generate_icon.py', cwd=root_dir)

    print("\n=== Step 2: Building Frontend (Vite) ===")
    run_command("npm run build", cwd=frontend_dir)

    print("\n=== Step 3: Packaging with PyInstaller ===")
    
    # PyInstaller コマンド引数
    # Windows の add-data セパレータはセミコロン (;)
    add_data_dist = f'"{frontend_dir / "dist"};frontend/dist"'
    add_data_assets = f'"{assets_dir};assets"'
    icon_arg = f'--icon="{assets_dir / "icon.ico"}"'
    splash_arg = f'--splash="{assets_dir / "splash.png"}"'
    
    hidden_imports = [
        "--hidden-import=uvicorn.logging",
        "--hidden-import=uvicorn.loops.auto",
        "--hidden-import=uvicorn.protocols.http.auto",
        "--hidden-import=uvicorn.lifespans.on",
        "--hidden-import=pystray._win32",
        "--hidden-import=PIL",
    ]
    
    pyinstaller_cmd = [
        f'"{sys.executable}" -m PyInstaller',
        "--onefile",
        "--noconsole",
        "--clean",
        "--name=LocalBan",
        icon_arg,
        splash_arg,
        f"--add-data {add_data_dist}",
        f"--add-data {add_data_assets}",
        *hidden_imports,
        "main.py"
    ]
    
    full_cmd = " ".join(pyinstaller_cmd)
    run_command(full_cmd, cwd=root_dir)

    exe_path = root_dir / "dist" / "LocalBan.exe"
    if exe_path.exists():
        size_mb = exe_path.stat().st_size / (1024 * 1024)
        print(f"\n==========================================")
        print(f" BUILD SUCCESSFUL!")
        print(f" Executable: {exe_path}")
        print(f" Size: {size_mb:.2f} MB")
        print(f"==========================================")

        print("\n=== Step 4: Creating Distribution ZIP Package ===")
        create_dist_zip(root_dir, exe_path)
    else:
        print("\nError: Executable was not found.")
        sys.exit(1)

if __name__ == "__main__":
    main()
