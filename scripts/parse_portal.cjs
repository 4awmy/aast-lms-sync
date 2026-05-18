const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration with environment variable overrides and sensible defaults
const CRED_FILE = process.env.CRED_FILE || path.join(process.env.HOME || process.env.USERPROFILE, 'lms_creds.txt');
const SCREENSHOT_PATH = process.env.SCREENSHOT_PATH || path.join(process.env.TEMP || '/tmp', 'portal_view.png');
const CSS_DIR = process.env.CSS_DIR || path.join(process.env.HOME || process.env.USERPROFILE, 'Downloads', 'MoodleStyles');
const PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || null;

async function parsePortal() {
    console.log("Starting portal parser...");
    
    if (!fs.existsSync(CRED_FILE)) {
        console.error("Credentials file not found at " + CRED_FILE);
        return;
    }

    const [username, password] = fs.readFileSync(CRED_FILE, 'utf8').split('\n').map(s => s.trim());

    const launchOptions = {
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
    };
    if (PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = PUPPETEER_EXECUTABLE_PATH;
    }

    const browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    try {
        console.log("Navigating to login page...");
        await page.goto('https://lms.aast.edu/login/index.php', { waitUntil: 'networkidle2' });

        console.log("Entering credentials...");
        await page.type('#username', username);
        await page.type('#password', password);
        
        await Promise.all([
            page.click('#loginbtn'),
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
        ]);

        console.log("Logged in. Parsing Moodle for logos and UI design elements...");

        const cookies = await page.cookies();
        const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        const uiDesign = await page.evaluate(() => {
            // 1. Logos and Images
            const images = Array.from(document.querySelectorAll('img')).map(img => ({
                src: img.src,
                alt: img.alt || '',
                className: img.className
            })).filter(img => img.src && (img.src.includes('logo') || img.className.includes('logo') || img.alt.toLowerCase().includes('logo') || img.src.endsWith('.png') || img.src.endsWith('.svg')));

            // 2. Colors & Typography (from body and primary elements)
            const bodyStyle = getComputedStyle(document.body);
            const navbar = document.querySelector('.navbar, nav, header');
            const navbarStyle = navbar ? getComputedStyle(navbar) : null;
            
            // Find a primary button to get brand color
            const primaryBtn = document.querySelector('.btn-primary, [type="submit"]');
            const btnStyle = primaryBtn ? getComputedStyle(primaryBtn) : null;

            // Find main text color
            const pText = document.querySelector('p, .text-muted, span');
            const pStyle = pText ? getComputedStyle(pText) : null;

            // 3. Layout & CSS Framework classes (looking for Bootstrap patterns common in Moodle)
            const containers = Array.from(document.querySelectorAll('.container, .container-fluid')).map(el => el.className);
            const buttons = Array.from(document.querySelectorAll('.btn')).map(el => el.className);
            const cards = Array.from(document.querySelectorAll('.card, .coursebox')).map(el => el.className);

            return {
                logos: images.slice(0, 10), // Limit to top 10 relevant images
                designSystem: {
                    fontFamily: bodyStyle.fontFamily,
                    backgroundColor: bodyStyle.backgroundColor,
                    textColor: bodyStyle.color,
                    linkColor: document.querySelector('a') ? getComputedStyle(document.querySelector('a')).color : '',
                    navbarBackground: navbarStyle ? navbarStyle.backgroundColor : 'N/A',
                    primaryButtonColor: btnStyle ? btnStyle.backgroundColor : 'N/A',
                    primaryButtonText: btnStyle ? btnStyle.color : 'N/A',
                    paragraphColor: pStyle ? pStyle.color : 'N/A'
                },
                layoutClasses: {
                    containers: [...new Set(containers)].slice(0, 5),
                    buttons: [...new Set(buttons)].slice(0, 5),
                    cards: [...new Set(cards)].slice(0, 5)
                }
            };
        });

        console.log("\nDownloading Brand Assets...");
        const ASSETS_DIR = path.join(CSS_DIR, 'assets');
        if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

        const assets = [
            { name: 'aast_main_logo.png', url: 'https://lms.aast.edu/pluginfile.php/1/theme_moove/logo/1761308096/logo50wide%20%281%29.png' },
            { name: 'aast_footer_logo.png', url: 'https://lms.aast.edu/theme/moove/pix/footer-logo.png' },
            { name: 'arab_league.png', url: 'https://aast.edu/template/ar/footer/img/arab_league.png' },
            { name: 'ain_logo.png', url: 'https://aast.edu/template/ar/footer/img/ain-logo.png' },
            { name: 'qs_stars.png', url: 'https://aast.edu/template/ar/footer/img/QS-STARS.png' },
            { name: 'moodle_white.png', url: 'https://lms.aast.edu/theme/moove/pix/moodle-logo-white.png' }
        ];

        for (const asset of assets) {
            try {
                const response = await axios.get(asset.url, { responseType: 'arraybuffer' });
                fs.writeFileSync(path.join(ASSETS_DIR, asset.name), response.data);
                console.log(`Downloaded Asset: ${asset.name}`);
            } catch (e) {
                console.error(`Failed to download asset ${asset.name}: ${e.message}`);
            }
        }

        console.log("\nExtracting detailed layout tokens...");
        const layoutTokens = await page.evaluate(() => {
            const getStyles = (selector) => {
                const el = document.querySelector(selector);
                if (!el) return null;
                const style = getComputedStyle(el);
                return {
                    padding: style.padding,
                    margin: style.margin,
                    borderRadius: style.borderRadius,
                    boxShadow: style.boxShadow,
                    border: style.border
                };
            };

            return {
                containers: getStyles('.container-fluid'),
                courseCards: getStyles('.coursebox, .card'),
                navbar: getStyles('.navbar'),
                buttons: getStyles('.btn-primary')
            };
        });

        console.log("=== Detailed Layout Tokens ===");
        console.log(JSON.stringify(layoutTokens, null, 2));

        console.log("\nCapturing fresh screenshot of the dashboard...");
        await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
        console.log("Screenshot saved to: " + SCREENSHOT_PATH);

    } catch (err) {

        console.error("Error during parsing:", err);
    } finally {
        await browser.close();
    }
}

parsePortal();
