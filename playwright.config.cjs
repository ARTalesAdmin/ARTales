const {defineConfig,devices}=require("@playwright/test");
const baseURL=process.env.PLAYWRIGHT_BASE_URL;
if(baseURL!=="http://127.0.0.1:3000")throw Error("Golden browser E2E must target only local Next.js on 127.0.0.1:3000");
module.exports=defineConfig({
 testDir:"./tests/browser",testMatch:"**/*.spec.cjs",forbidOnly:true,
 timeout:240000,expect:{timeout:20000},
 retries:0,workers:1,reporter:[["line"]],
 use:{...devices["Desktop Chrome"],channel:"chrome",baseURL,trace:"retain-on-failure",screenshot:"only-on-failure"},
});
