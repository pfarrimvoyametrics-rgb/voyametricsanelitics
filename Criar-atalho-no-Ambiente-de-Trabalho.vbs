' Cria um atalho "VoyaMetrics - Medidor SLA Email" no Ambiente de Trabalho,
' a apontar para o lançador único, com o ícone de marca.
Option Explicit
Dim sh, fso, base, desktop, lnk
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
desktop = sh.SpecialFolders("Desktop")

Set lnk = sh.CreateShortcut(desktop & "\VoyaMetrics - Medidor SLA Email.lnk")
lnk.TargetPath = base & "\Central de Tickets.vbs"
lnk.WorkingDirectory = base
lnk.IconLocation = base & "\icone.ico, 0"
lnk.Description = "Abrir o VoyaMetrics - Medidor SLA Email"
lnk.Save

MsgBox "Atalho 'VoyaMetrics - Medidor SLA Email' criado no Ambiente de Trabalho." & vbCrLf & vbCrLf & _
       "Use esse ícone para abrir a aplicação.", 64, "VoyaMetrics"
