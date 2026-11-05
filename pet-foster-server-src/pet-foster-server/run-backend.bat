@echo off
cd /d "C:\Users\chen\Desktop\毕业设计\pet-foster\pet-foster-server-src\pet-foster-server"
"C:\Program Files\JetBrains\IntelliJ IDEA 2024.2.3\plugins\maven\lib\maven3\bin\mvn.cmd" spring-boot:run -o -Dmaven.legacyLocalRepo=true > backend.log 2>&1