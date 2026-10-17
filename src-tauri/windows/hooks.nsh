; LocalBan NSIS Installer/Uninstaller Hooks

!macro NSIS_HOOK_POSTUNINSTALL
  ; ユーザーがアンインストール確認画面で「アプリケーションデータを削除する」を選択しており、
  ; かつアップデート（上書き更新）でない場合に、LocalBan の全データディレクトリを完全消去する
  ${If} $DeleteAppDataCheckboxState = 1
  ${AndIf} $UpdateMode <> 1
    SetShellVarContext current
    RMDir /r "$APPDATA\LocalBan"
    RMDir /r "$LOCALAPPDATA\com.localban.desktop"
  ${EndIf}
!macroend
