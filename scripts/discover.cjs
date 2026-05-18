const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration with environment variable overrides and sensible defaults
const BASE_DIR = process.env.BASE_DIR || path.join(process.env.TEMP || '/tmp', 'lms_scraper');
const SESSION_FILE = path.join(BASE_DIR, 'session.json');
const CRED_FILE = process.env.CRED_FILE || path.join(process.env.HOME || process.env.USERPROFILE, 'lms_creds.txt');
const PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || null;

async function discoverCourses() {
    console.log("Discovering courses from LMS...");

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

    if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true });

    if (fs.existsSync(SESSION_FILE)) {
        const cookies = JSON.parse(fs.readFileSync(SESSION_FILE));
        await page.setCookie(...cookies);
    }

    try {
        console.log("Navigating to My Courses...");
        await page.goto('https://lms.aast.edu/my/', { waitUntil: 'domcontentloaded', timeout: 60000 });

        if (page.url().includes('login/index.php')) {
            console.log('Logging in...');
            if (!fs.existsSync(CRED_FILE)) throw new Error(`Credentials file not found at ${CRED_FILE}`);
            const [u, p] = fs.readFileSync(CRED_FILE, 'utf8').split('\n').map(s => s.trim());
            
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

            await Promise.all([
                page.click('#loginbtn'),
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 })
            ]);
            
            if (!page.url().includes('login/index.php')) {
                console.log("Login successful.");
                fs.writeFileSync(SESSION_FILE, JSON.stringify(await page.cookies(), null, 2));
                await page.goto('https://lms.aast.edu/my/', { waitUntil: 'domcontentloaded', timeout: 60000 });
            } else {
                throw new Error("Login failed. Check your credentials.");
            }
        }

        console.log("Extracting courses...");
        // Wait a bit for dynamic content if needed
        await new Promise(r => setTimeout(r, 2000));

        const courses = await page.evaluate(() => {
            const results = [];
            const seenIds = new Set();

            // Moodle 4.x Dashboard often uses data-course-id or links in cards
            const links = Array.from(document.querySelectorAll('a[href*="course/view.php?id="]'));
            
            links.forEach(link => {
                const url = new URL(link.href);
                const id = url.searchParams.get('id');
                // Try to get a clean name. Often the link text is the course name.
                // We filter out short strings or purely icon/meta text.
                let name = link.innerText.trim();
                
                // Fallback to parent card title if link text is empty or "View"
                if (!name || name.toLowerCase() === 'view') {
                    const card = link.closest('.card, .coursebox, .course-info-container');
                    if (card) {
                        const titleEl = card.querySelector('.coursename, .course-name, h5, h6');
                        if (titleEl) name = titleEl.innerText.trim();
                    }
                }

                if (id && name && !seenIds.has(id) && name.length > 3) {
                    results.push({ id, name: name.replace(/\n/g, ' ').replace(/\s+/g, ' ') });
                    seenIds.add(id);
                }
            });

            return results;
        });

        if (courses.length === 0) {
            console.log("No courses found. The dashboard might be empty or using unknown selectors.");
            console.log("Current URL:", page.url());
        } else {
            console.log("\nEnrolled Courses:");
            console.log("-----------------");
            courses.forEach(c => {
                console.log(`ID: ${c.id.padEnd(6)} | Name: ${c.name}`);
            });
            console.log("-----------------");
            console.log(`Total: ${courses.length} courses found.`);
        }

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close();
    }
}

discoverCourses();
