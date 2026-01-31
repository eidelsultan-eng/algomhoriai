echo Enabling external access for port 8080...
echo Please confirm the Admin prompt if it appears.

:: Add firewall rule for port 8080
powershell -Command "Start-Process powershell -ArgumentList 'New-NetFirewallRule -DisplayName \"AL_GOMHOURIA_LAB_SYNC\" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow -Profile Any' -Verb RunAs"

echo ------------------------------------------
echo Port 3000 is now OPEN for other devices.
echo Try Opening: http://192.168.1.11:3000 on your other devices.
echo ------------------------------------------
pause
