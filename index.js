const path = require('path');
const fs = require('fs-extra');

const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const notifier = require('node-notifier');

const Logger = require('./logger');
const utils = require('./utils');
const { CONFIG, USER_AGENTS } = require('./config');
const GOOGLE_COOKIES = require('./cookies');

const logger = new Logger();
logger.intro(CONFIG.instances);

const cleanup = async () => {

	fs.emptyDir(path.resolve('tmp'));

}

const splash = async (instance, config) => {

	try {

		let userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
		let viewportX = Math.floor(1200 * (1 + 0.1 * Math.random()));
		let viewportY = Math.floor(800 * (1 + 0.1 * Math.random()));

		const browser = await puppeteer.launch({
			headless: CONFIG.headless,
			//executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
			args: [
				//'--no-startup-window',
				//'--start-fullscreen',
				'--no-default-browser-check',
				'--disable-sync',
				'--disable-infobars',
				'--disable-web-security',
				//'--enable-translate-new-ux',
				`--user-agent=${userAgent}`,
				//`--window-size=${viewportX},${viewportY}`,
				`--user-data-dir=${path.resolve('tmp', 'chrome_' + instance)}`,
				`--profile-directory=PROFILE_${instance}`
			]
		});

		const [ defaultPage ] = await browser.pages();
		
		const cookiePage = await browser.newPage();
		await defaultPage.close();
		await cookiePage.goto('http://www.google.com/404');
		for (let cookie of GOOGLE_COOKIES) {
			await cookiePage.setCookie({
				name: cookie.name,
				value: cookie.value
			});
		}
		
		await cookiePage.close();
		const page = await browser.newPage();
		page.setDefaultNavigationTimeout(60000);
		await page.emulate(devices['iPhone 6']);
		// await page.setViewport({
		// 	width: viewportX,
		// 	height: viewportY
		// });
		await page.goto(config.splashURL);




		// await page.setCookie({
		// 	name: 'HRPYYU',
		// 	value: 'true',
		// 	domain: 'www.adidas.de'
		// })

		while (!(await page.evaluate(() => typeof grecaptcha !== "undefined"))) {
			logger.info(instance, await page.evaluate(() => document.title));
			await page.waitFor(config.timeout * 1000);
			if (config.reload) await page.goto(config.splashURL);
		}

		let cookieJar = await page.cookies();
		let hmacName = '';
		let hmacVal = '';
		for (let cookie of cookieJar) {
			if (cookie.value.includes('hmac')) {
				hmacName = cookie.name;
				hmacVal = cookie.value;
			}
		}

		let saveDir = path.resolve('save', Date.now().toString());
		await fs.ensureDir(saveDir);

		await fs.outputFile(path.resolve(saveDir, 'index.html'), await page.content());
		await fs.outputFile(path.resolve(saveDir, 'cookies.json'), JSON.stringify(cookieJar));
		await fs.outputFile(path.resolve(saveDir, 'ua.txt'), userAgent);
		await fs.outputFile(path.resolve(saveDir, 'body.png'), await page.screenshot());

		logger.success(instance, hmacName, hmacVal, userAgent);

		notifier.notify({
			title: '❯❯❯_ Kju',
			//icon: path.resolve('media', 'icon.png'),
			contentImage: path.resolve(saveDir, 'body.png'),
			message: `Through Splash on Instance ${instance}!`,
			sound: 'Hero',
			timeout: 60000
		}, async (err, res, data) => {
			if (res == 'activate') await page.bringToFront();
		});
	
	} catch (err) {

		logger.error(instance, err);

	}

}

const main = async () => {

	await cleanup();
	
	for (let i = 1; i <= CONFIG.instances; i++) {
		await utils.timeout(500);
		splash(i.pad(), CONFIG);
	}

}

main();
