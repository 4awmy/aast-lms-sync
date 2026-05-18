const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration with environment variable overrides and sensible defaults
const SKILL_DIR = process.env.SKILL_DIR || path.join(__dirname, '..');
const BASE_DIR = process.env.BASE_DIR || path.join(process.env.TEMP || '/tmp', 'lms_scraper');
const SESSION_FILE = path.join(BASE_DIR, 'session.json');
const CRED_FILE = process.env.CRED_FILE || path.join(process.env.HOME || process.env.USERPROFILE, 'lms_creds.txt');
const DOWNLOAD_DIR = path.join(BASE_DIR, 'downloads_sync');
const COURSES_JSON = path.join(SKILL_DIR, 'courses.json');
const GDOWN_PATH = process.env.GDOWN_PATH || 'gdown'; // Assume in PATH by default
const PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || null; // Let puppeteer find it if not specified

async function syncGoogleDrive(url, targetDir) {
    console.log(`Syncing Google Drive source via gdown: ${url}...`);
    try {
        // gdown --folder <url> -O <targetDir> --remaining-ok --no-cookies
        const cmd = `"${GDOWN_PATH}" --folder "${url}" -O "${targetDir}" --remaining-ok --no-cookies`;
        console.log(`Executing: ${cmd}`);
        execSync(cmd, { stdio: 'inherit' });
    } catch (e) {
        console.error(`Gdown failed: ${e.message}`);
    }
}

async function syncCourse(input, localRoot) {
    let courseId = input;
    let extraSources = null;
    
    // Look up ID if name is provided
    if (isNaN(input)) {
        const courses = JSON.parse(fs.readFileSync(COURSES_JSON, 'utf8'));
        // Fuzzy match or exact match
        const found = Object.keys(courses).find(name => name.toLowerCase().includes(input.toLowerCase()));
        if (found) {
            const courseData = courses[found];
            courseId = typeof courseData === 'string' ? courseData : courseData.id;
            extraSources = courseData.extra_sources || null;
            console.log(`Mapping "${input}" to LMS ID: ${courseId}`);
        } else {
            console.error(`Course name "${input}" not found in courses.json`);
            process.exit(1);
        }
    }

    if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

    const launchOptions = {
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
    };
    if (PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = PUPPETEER_EXECUTABLE_PATH;
    }

    const browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    if (fs.existsSync(SESSION_FILE)) {
        const cookies = JSON.parse(fs.readFileSync(SESSION_FILE));
        await page.setCookie(...cookies);
    }

    try {
        console.log(`Navigating to Course ${courseId}...`);
        await page.goto(`https://lms.aast.edu/course/view.php?id=${courseId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });

        if (page.url().includes('login/index.php')) {
            console.log('Logging in...');
            if (!fs.existsSync(CRED_FILE)) throw new Error('lms_creds.txt not found.');
            const [u, p] = fs.readFileSync(CRED_FILE, 'utf8').split('\n').map(s => s.trim());
            console.log(`Using username: ${u}`);
            await page.focus('#username');
            await page.keyboard.down('Control');
            await page.keyboard.press('A');
            await page.keyboard.up('Control');
            await page.keyboard.press('Backspace');
            await page.type('#username', u);

            await page.focus('#password');
            await page.keyboard.down('Control');
            await page.keyboard.press('A');
            await page.keyboard.up('Control');
            await page.keyboard.press('Backspace');
            await page.type('#password', p);
            console.log('Clicking login button...');
            await Promise.all([
                page.click('#loginbtn'),
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => console.log("Navigation error after login:", e.message))
            ]);
            
            const postLoginUrl = page.url();
            console.log(`URL after login attempt: ${postLoginUrl}`);
            if (postLoginUrl.includes('login/index.php')) {
                const loginError = await page.evaluate(() => document.querySelector('.alert-danger, #loginerrormessage')?.innerText.trim());
                if (loginError) console.error(`Login failed with error: ${loginError}`);
                else console.error("Still on login page after click, no error found.");
            } else {
                console.log("Login seems successful.");
                fs.writeFileSync(SESSION_FILE, JSON.stringify(await page.cookies(), null, 2));
                await page.goto(`https://lms.aast.edu/course/view.php?id=${courseId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
            }
        }

        const sections = await page.evaluate(() => {
            const data = [];
            // Updated selectors for Moodle 4.x
            const sectionElements = document.querySelectorAll('.course-section, .section.main, li.section, .mod-indent');
            sectionElements.forEach(s => {
                const name = s.getAttribute('aria-label') || s.querySelector('.sectionname, h3, .section-title')?.innerText.trim() || "General";
                const resources = [];
                // Look for activity items
                s.querySelectorAll('.activity-item, .activityinstance, .activity, .activity-name').forEach(i => {
                    const rNameRaw = i.querySelector('.instancename, .activityname, .instancename')?.innerText.trim() || i.innerText.trim();
                    // Clean name (remove trailing File/PPTX etc info)
                    const rName = rNameRaw.split('\n')[0].trim();
                    const link = i.querySelector('a')?.href;
                    if (rName && link && (link.includes('mod/resource/view.php') || link.includes('mod/assign/view.php'))) {
                        resources.push({ name: rName, link, type: link.includes('assign') ? 'assign' : 'resource' });
                    }
                });
                if (resources.length > 0) data.push({ sectionName: name, resources });
            });
            return data;
        });

        if (sections.length === 0) {
            console.log("No sections found via selectors. Dumping body text for debugging:");
            const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
            console.log(bodyText);
            
            // Try fallback: look for ANY links with mod/resource or mod/assign
            const allLinks = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('a'))
                    .map(a => ({ name: a.innerText.trim(), link: a.href }))
                    .filter(l => l.link.includes('mod/resource/view.php') || l.link.includes('mod/assign/view.php'));
            });
            if (allLinks.length > 0) {
                console.log(`Fallback: Found ${allLinks.length} total resource/assign links.`);
                sections.push({ sectionName: "General", resources: allLinks.map(l => ({ ...l, type: l.link.includes('assign') ? 'assign' : 'resource' })) });
            }
        }

        console.log(`Found ${sections.length} sections.`);
        sections.forEach(s => {
            console.log(`- Section: ${s.sectionName} (${s.resources.length} resources)`);
            s.resources.forEach(r => console.log(`  - [${r.type}] ${r.name}`));
        });

        const cookies = await page.cookies();
        const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        // Map local files
        const localMap = [];
        const walk = (dir) => {
            if (!fs.existsSync(dir)) return;
            fs.readdirSync(dir).forEach(f => {
                const pth = path.join(dir, f);
                if (fs.statSync(pth).isDirectory()) walk(pth);
                else localMap.push({ name: f, size: fs.statSync(pth).size, fullPath: pth });
            });
        };
        walk(localRoot);

        // Sync each section
        for (const sec of sections) {
            const weekMatch = sec.sectionName.match(/week\s*(\d+)/i);
            const weekPrefix = weekMatch ? `Week ${weekMatch[1].padStart(2, '0')} - ` : "";

            for (const res of sec.resources) {
                console.log(`Checking ${res.name}...`);
                if (res.type === 'assign') {
                    // Navigate to assignment page to find actual download link
                    try {
                        await page.goto(res.link, { waitUntil: 'domcontentloaded', timeout: 30000 });
                        const assignLinks = await page.evaluate(() => {
                            return Array.from(document.querySelectorAll('.activity-description a, .submissionstatustable a'))
                                .map(a => ({ name: a.innerText.trim(), link: a.href }))
                                .filter(l => l.link.includes('mod/resource/view.php') || l.link.includes('pluginfile.php'));
                        });
                        for (const al of assignLinks) {
                            await downloadFile(al.link, al.name || res.name, weekPrefix, localRoot, cookieStr, localMap);
                        }
                    } catch (e) { console.error(`Failed assignment ${res.name}: ${e.message}`); }
                    continue;
                }
                await downloadFile(res.link, res.name, weekPrefix, localRoot, cookieStr, localMap);
            }
        }

        async function downloadFile(link, name, weekPrefix, localRoot, cookieStr, localMap) {
            try {
                const response = await axios.get(link, { headers: { 'Cookie': cookieStr }, responseType: 'stream', maxRedirects: 10 });
                const cd = response.headers['content-disposition'];
                let filename = name;
                if (cd && cd.includes('filename=')) filename = cd.split('filename=')[1].replace(/["']/g, '');
                
                // Add extension if missing and possible from content-type
                if (!filename.includes('.') && response.headers['content-type']) {
                    const ct = response.headers['content-type'];
                    if (ct.includes('pdf')) filename += '.pdf';
                    else if (ct.includes('word')) filename += '.docx';
                    else if (ct.includes('powerpoint')) filename += '.pptx';
                }

                const tempPath = path.join(DOWNLOAD_DIR, filename);
                const writer = fs.createWriteStream(tempPath);
                response.data.pipe(writer);
                await new Promise((r, j) => { writer.on('finish', r); writer.on('error', j); });
                
                const size = fs.statSync(tempPath).size;
                const existing = localMap.find(l => l.size === size);

                let targetType = "Lectures";
                if (name.toLowerCase().includes('sheet') || name.toLowerCase().includes('section')) targetType = "Sections";
                if (name.toLowerCase().includes('assignment') || name.toLowerCase().includes('project')) {
                    const isAnswer = name.toLowerCase().includes('ans') || name.toLowerCase().includes('answer') || filename.toLowerCase().includes('ans') || filename.toLowerCase().includes('answer');
                    targetType = path.join("Assignments", isAnswer ? "Answers" : "Questions");
                }

                const finalDir = path.join(localRoot, targetType);
                if (!fs.existsSync(finalDir)) fs.mkdirSync(finalDir, { recursive: true });

                const finalName = weekPrefix + filename;
                const finalPath = path.join(finalDir, finalName);

                if (!existing) {
                    fs.renameSync(tempPath, finalPath);
                    console.log(`Synced: ${finalName}`);
                } else {
                    fs.unlinkSync(tempPath);
                    if (path.basename(existing.fullPath) !== finalName) {
                        fs.renameSync(existing.fullPath, finalPath);
                        console.log(`Renamed existing: ${finalName}`);
                    }
                }
            } catch (e) { console.error(`Failed ${name}: ${e.message}`); }
        }
        // Handle extra sources
        if (extraSources) {
            for (const [type, url] of Object.entries(extraSources)) {
                const targetDir = path.join(localRoot, type);
                if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
                
                // Save source link
                const sourceFile = path.join(targetDir, 'source.txt');
                if (!fs.existsSync(sourceFile) || fs.readFileSync(sourceFile, 'utf8') !== url) {
                    fs.writeFileSync(sourceFile, url);
                    console.log(`Updated source link for ${type}: ${url}`);
                }

                // If Google Drive, sync content
                if (url.includes('drive.google.com')) {
                    await syncGoogleDrive(url, targetDir, browser);
                }
            }
        }

        await browser.close();
        console.log("Sync Complete.");
    } catch (e) { console.error(e); if (browser) await browser.close(); }
}

const [input, dir] = process.argv.slice(2);
syncCourse(input, dir);
