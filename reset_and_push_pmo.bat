@echo off
echo ============================================
echo  CLEAN RESET AND PUSH PMO TO GITHUB
echo ============================================

cd /d D:\SourceCode\PMO

echo.
echo Initializing fresh Git repo...
git init

echo.
echo Creating .gitignore...
(
  echo .env
  echo Backups/
  echo __pycache__/
  echo *.zip
  echo *.exe
  echo *.pkl
  echo *.bin
  echo *.h5
  echo App/nul
) > .gitignore

echo.
echo Adding remote origin...
git remote add origin https://github.com/Sri1972/PMO.git

echo.
echo Adding all project files...
git add .

echo.
echo Committing changes...
git commit -m "Clean full commit from D:\\SourceCode\\PMO"

echo.
echo Setting main branch...
git branch -M main

echo.
echo Configuring Git LFS (for large files)...
git lfs install
git lfs track "*.zip"
git lfs track "*.exe"
git lfs track "*.pkl"
git lfs track "*.bin"
git lfs track "*.h5"
git add .gitattributes
git commit -m "Configured Git LFS tracking" || echo (no new files to commit)

echo.
echo Pushing to GitHub (force overwrite)...
git push -u origin main --force

echo.
echo Done! Your PMO repo is now synced cleanly.
pause