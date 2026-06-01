; ─── VALERIE NSIS installer hooks ────────────────────────────────────────────
; Runs after the files are copied but before the installer closes.
; Sets a custom folder icon so the VALERIE install directory shows the app
; icon in Windows Explorer instead of a plain yellow folder.

!macro NSIS_HOOK_POSTINSTALL
  ; ── Custom folder icon via desktop.ini ──────────────────────────────────────
  ; Tell Explorer to use the VALERIE icon for this folder
  WriteINIStr "$INSTDIR\desktop.ini" ".ShellClassInfo" "IconResource" "$INSTDIR\resources\icon.ico,0"
  WriteINIStr "$INSTDIR\desktop.ini" ".ShellClassInfo" "IconFile"     "$INSTDIR\resources\icon.ico"
  WriteINIStr "$INSTDIR\desktop.ini" ".ShellClassInfo" "IconIndex"    "0"
  WriteINIStr "$INSTDIR\desktop.ini" "ViewState" "FolderType" "Generic"

  ; Mark desktop.ini as Hidden+System (required for Windows to read it)
  SetFileAttributes "$INSTDIR\desktop.ini" HIDDEN|SYSTEM

  ; Mark the install folder itself as System (enables the custom icon)
  SetFileAttributes "$INSTDIR" SYSTEM

  ; ── Uninstaller display icon in Apps & Features ───────────────────────────
  ; Point the Programs and Features icon to the app's own icon
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" \
    "DisplayIcon" "$INSTDIR\${MAIN_APP_EXE}"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Clean up desktop.ini on uninstall so no orphan hidden files remain
  Delete "$INSTDIR\desktop.ini"
!macroend
