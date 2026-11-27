!macro NSIS_HOOK_PREINSTALL
  ; Reserve the default LocalAppData product directory for persistent user data.
  StrCmp $INSTDIR "$LOCALAPPDATA\${PRODUCTNAME}" 0 +3
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\${PRODUCTNAME}"
  SetOutPath $INSTDIR
!macroend
