@echo off
title Al-Gomhouria Lab - Local Server
echo ------------------------------------------
echo Starting Al-Gomhouria Lab Internal Server...
echo ------------------------------------------

SET NODE_PATH="C:\Program Files\Microsoft Visual Studio\18\Insiders\MSBuild\Microsoft\VisualStudio\NodeJs\node.exe"

if exist %NODE_PATH% (
    %NODE_PATH% server.js
) else (
    echo Searching for Node.js in common folders...
    if exist "C:\Program Files\nodejs\node.exe" (
        "C:\Program Files\nodejs\node.exe" server.js
    ) else (
        echo ERROR: Node.js not found. 
        echo Please RESTART your computer to complete installation.
        pause
    )
)
pause
