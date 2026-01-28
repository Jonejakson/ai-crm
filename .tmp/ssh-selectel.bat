@echo off
ssh -o BatchMode=yes -o ConnectTimeout=30 -i %USERPROFILE%\.ssh\id_ed25519 root@79.143.30.96 "echo connected && hostname && ls /opt"
echo Exit: %ERRORLEVEL%
