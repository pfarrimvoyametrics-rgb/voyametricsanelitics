' ============================================================
'  VoyaMetrics - Medidor SLA Email - lançador único
'  Abre a aplicação numa janela dedicada (sem janelas de consola).
'  Quando FECHAR essa janela, os servidores são desligados sozinhos.
' ============================================================
Option Explicit
Dim sh, fso, base, url, perfil
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
url = "http://localhost:5173"
perfil = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\CentralTickets"

' 1) Arranca backend e frontend OCULTOS (0 = sem janela ; False = nao esperar)
sh.Run "cmd /c cd /d """ & base & "\backend"" && npm run dev", 0, False
sh.Run "cmd /c cd /d """ & base & "\frontend"" && npm run dev", 0, False

' 2) Espera (oculto) que a interface esteja pronta na porta 5173
sh.Run "powershell -NoProfile -WindowStyle Hidden -Command ""for($i=0;$i -lt 90;$i++){try{(New-Object Net.Sockets.TcpClient('localhost',5173)).Close();break}catch{Start-Sleep 1}}""", 0, True

' 3) Abre a app numa janela dedicada no GOOGLE CHROME e ESPERA que a fechem.
'    Tenta o chrome.exe (PATH) e depois os locais habituais de instalacao.
'    So recorre ao Edge se o Chrome nao existir mesmo.
Dim aberto
aberto = False
On Error Resume Next
sh.Run "chrome.exe --app=" & url & " --new-window --user-data-dir=""" & perfil & """", 1, True
If Err.Number = 0 Then aberto = True
Err.Clear
If Not aberto Then
  sh.Run """" & sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\Google\Chrome\Application\chrome.exe"" --app=" & url & " --new-window --user-data-dir=""" & perfil & """", 1, True
  If Err.Number = 0 Then aberto = True
  Err.Clear
End If
If Not aberto Then
  sh.Run """" & sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Google\Chrome\Application\chrome.exe"" --app=" & url & " --new-window --user-data-dir=""" & perfil & """", 1, True
  If Err.Number = 0 Then aberto = True
  Err.Clear
End If
If Not aberto Then
  sh.Run "msedge.exe --app=" & url & " --new-window --user-data-dir=""" & perfil & """", 1, True
  Err.Clear
End If
On Error GoTo 0

' 4) Janela fechada -> desliga os servidores (reutiliza o Parar)
sh.Run "cmd /c """ & base & "\Parar-Central-Tickets.bat""", 0, True
