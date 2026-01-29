@echo off
echo Setting up Network Permissions for Al-Gomhouria Lab...
echo Please click YES when the admin prompt appears.
powershell -Command "Start-Process powershell -ArgumentList 'New-NetFirewallRule -DisplayName \"Al-Gomhouria Lab Server\" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow' -Verb RunAs"
echo ------------------------------------------
echo DONE! The "Network Door" is now open.
echo You can now access the app via URL: http://192.168.1.8:3000
echo ------------------------------------------
pause
