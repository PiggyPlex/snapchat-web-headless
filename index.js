const puppeteer = require('puppeteer-extra')
const inquirer = require('inquirer')

const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

const config = {
  username: 'USERNAME_HERE',
  password: 'PASSWORD_HERE',
}

;(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    width: 1280,
    height: 720,
  });
  const page = await browser.newPage()
  console.log('opening Snapchat...')
  await page.goto('https://web.snapchat.com')
  console.log('opened Snapchat')
  await page.addStyleTag({ content: "*{scroll-behavior: auto !important;}" })
  await page.waitForSelector('input[name="username"]')
  await page.type('input[name="username"]', config.username)
  await page.waitForSelector('input[name="password"]')
  await page.type('input[name="password"]', config.password)
  console.log('typed credentials')
  await page.waitForSelector('.cookie-pop-up')
  await page.$eval('.cookie-pop-up', (el) => {
    el.style.display = 'none'
  })
  console.log('clicked cookie accept')
  await page.waitForTimeout(6000)
  console.log('captcha loaded, solving now...')
  const captchaFrame = page.frames().find(frame => frame.name() === 'CaptchaFrame')
  const captchaFrameBody = await captchaFrame.$('body')
  await captchaFrame.waitForSelector('button#home_children_button')
  await (await captchaFrame.$('#home_children_button')).click()
  await page.waitForTimeout(500)
  await captchaFrameBody.screenshot({
    path: 'captcha.png'
  })
  await captchaFrame.waitForSelector('#game_children_challenge li')
  let captchaComplete = false
  while (!captchaComplete) {
    const { solution } = await inquirer.prompt([{
      type: 'input',
      name: 'solution',
      message: 'enter the solution to the captcha',
    }])
    console.log('attempting to solve captcha with solution', solution)
    await page.waitForTimeout(200)
    const captchaResult = await captchaFrame.evaluate((solution) => {
      const clickableOverlay = document.querySelector(`#image${solution}`)
      if (!clickableOverlay)
        return true
      clickableOverlay.firstChild.click()
      return false
    }, solution)
    console.log('solved captcha with solution', solution)
    // await captchaFrame.click(`#game_children_challenge li#image${solution}`)
    await page.waitForTimeout(1000)
    await captchaFrameBody.screenshot({
      path: 'captcha_state.png'
    })
    if (captchaResult)
      captchaComplete = true
  }
  await page.screenshot({
    path: 'example.png',
    fullPage: true
  })
  await page.waitForTimeout(1000)
  const retryCaptchaButton = await captchaFrame.$('#wrong_children_button')
  if (retryCaptchaButton) {
    console.log('invalid captcha')
    process.exit(1)
    return
  }
  await page.waitForFunction(() => {
    const loginTrigger = document.querySelector('#loginTrigger')
    return !loginTrigger.disabled
  })
  await page.waitForTimeout(500)
  await page.click('#loginTrigger')
  console.log('clicked login')
  await page.waitForSelector('.tiv-verifyCardTitle')
  console.log('confirm in Snapchat - open your phone')
  await page.waitForSelector('input[placeholder="Search"]', { timeout: 5 * 60 * 1000})
  await page.waitForTimeout(1000)
  console.log('logged in')
  page.waitForSelector('.ReactVirtualized__Grid__innerScrollContainer [role="gridcell"]')
  await page.waitForTimeout(4000)
  await page.screenshot({
    path: 'snapchat.png',
    fullPage: true
  })
  const fetchChats = () => {
    return page.evaluate(() => {
      const chats = [...document.querySelectorAll('.ReactVirtualized__Grid__innerScrollContainer [role="gridcell"]')]
      if (!chats.length) return
      return chats.map(el => {
        if (!el) return {}
        const chat = el.firstChild
        if (!chat) return {}
        const chatInfo = chat.children[1]
        if (!chatInfo) return {}
        const [ action, time ] = chatInfo.children?.[1]?.innerText?.split?.('\n·\n') || []
        return {
            bitmoji: chat.firstChild.firstChild.firstChild.src,
            name: chatInfo.firstChild.innerText,
            action,
            time
        }
      })
    })
  }
  const chats = await fetchChats()
  console.log('chats', chats)
  setInterval(async () => {
    const chats = await fetchChats()
    console.log('chats', chats)
  }, 1 * 1000)
  // await browser.close()
})()
