# Fiverr rule-based fraud QA — 130 synthetic messages

Synthetic, message-level rule evaluation. Inline catalog scorer after catalog load is primary; normalized legacy flag scoring and unnormalized preview scoring are reported separately. This is not a live DOM recall test or production accuracy estimate.

No production rules, weights, or thresholds were changed for this evaluation. Expected labels are human-authored QA judgments, not verified fraud outcomes.

## Classification results

| Path | Correct | Accuracy | False positives | Missed warnings | Red → yellow | Yellow → red |
|---|---:|---:|---:|---:|---:|---:|
| inline | 64/130 | 49.2% | 17 | 32 | 17 | 0 |
| flag | 98/130 | 75.4% | 5 | 26 | 1 | 0 |

False positive means expected green but actual yellow/red. Missed warning means expected yellow/red but actual green. Red → yellow is reported separately as missed high-risk severity. Correct classifications require an exact three-color match.

Inline/flag disagreement: 49/130. Flag/preview disagreement: 1/130.

## Results by requested group

| Group | Cases | Inline correct | Flag correct | Inline FP | Inline missed | Undergraded | Overgraded |
|---|---:|---:|---:|---:|---:|---:|---:|
| legitimate | 20 | 16 | 19 | 4 | 0 | 0 | 0 |
| suspicious | 20 | 7 | 11 | 0 | 13 | 0 | 0 |
| highRisk | 20 | 7 | 19 | 0 | 3 | 10 | 0 |
| legitimateExternalContact | 10 | 7 | 8 | 3 | 0 | 0 | 0 |
| legitimatePayment | 10 | 5 | 8 | 5 | 0 | 0 | 0 |
| links | 10 | 5 | 6 | 2 | 2 | 1 | 0 |
| unusualSpelling | 10 | 2 | 2 | 0 | 8 | 0 | 0 |
| emojis | 10 | 6 | 10 | 1 | 1 | 2 | 0 |
| mixedCase | 10 | 7 | 10 | 1 | 0 | 2 | 0 |
| multiSentence | 10 | 2 | 5 | 1 | 5 | 2 | 0 |

## Inline confusion matrix

| Expected / actual | Green | Yellow | Red |
|---|---:|---:|---:|
| green | 37 | 12 | 5 |
| yellow | 20 | 10 | 0 |
| red | 12 | 17 | 17 |

## Incorrect inline classifications

| Case | Expected | Actual / score | Error | Message | Matched categories |
|---|---|---|---|---|---|
| legitimate-11 | green | red / 100 | falsePositive | Never share your password or verification code with a buyer. | fake_support, account_credentials |
| legitimate-12 | green | yellow / 35 | falsePositive | Do not install AnyDesk or give anyone remote access for this order. | malicious_download |
| legitimate-16 | green | red / 60 | falsePositive | The fictional character in the script says 'send your password'; please remove that line. | account_credentials |
| legitimate-19 | green | yellow / 35 | falsePositive | Do not pay any registration fee to someone claiming to offer you work. | payment_request, job_offer_scam |
| suspicious-04 | yellow | green / 25 | falseNegative | Share your phone number and I will call about the brief. | external_contact |
| suspicious-05 | yellow | green / 10 | falseNegative | Message my assistant on WhatsApp for the project requirements. | off_platform_communication |
| suspicious-06 | yellow | green / 10 | falseNegative | Join my Discord server so we can coordinate the design. | off_platform_communication |
| suspicious-07 | yellow | green / 10 | falseNegative | Let's chat on Skype about the next revision. | off_platform_communication |
| suspicious-09 | yellow | green / 25 | falseNegative | Email me the next draft instead of uploading it here. | external_contact |
| suspicious-10 | yellow | green / 10 | falseNegative | DM me on Instagram to discuss the package. | external_contact |
| suspicious-13 | yellow | green / 20 | falseNegative | Contact our project manager on WhatsApp before we discuss the scope. | off_platform_communication, external_contact |
| suspicious-14 | yellow | green / 20 | falseNegative | Please use Facebook Messenger for the next meeting. | off_platform_communication, external_contact |
| suspicious-15 | yellow | green / 10 | falseNegative | Give me your personal email for project updates. | external_contact |
| suspicious-16 | yellow | green / 10 | falseNegative | Could you send your mobile number rather than reply here? | external_contact |
| suspicious-18 | yellow | green / 10 | falseNegative | Please reach me on Telegram at the username in my profile. | off_platform_communication |
| suspicious-19 | yellow | green / 10 | falseNegative | We should connect via WhatsApp for faster replies. | off_platform_communication |
| suspicious-20 | yellow | green / 20 | falseNegative | Send me your Discord handle so I can message you there. | off_platform_communication, external_contact |
| highRisk-03 | red | yellow / 40 | undergraded | Enter your card number and CVV on my verification page to receive your earnings. | external_contact, fake_support, suspicious_link, personal_information |
| highRisk-05 | red | yellow / 35 | undergraded | Install AnyDesk and give me remote access to your computer. | malicious_download |
| highRisk-06 | red | yellow / 35 | undergraded | Pay a verification fee before your Fiverr payment can be released. | payment_request, fake_support |
| highRisk-07 | red | yellow / 35 | undergraded | Send bitcoin to my wallet to unlock the money from your order. | cryptocurrency |
| highRisk-08 | red | yellow / 45 | undergraded | Buy gift cards and send me the redemption codes to activate your seller account. | gift_card, phishing |
| highRisk-09 | red | yellow / 35 | undergraded | Pay outside Fiverr by transferring the money directly to my bank. | off_platform_payment |
| highRisk-12 | red | yellow / 45 | undergraded | Paste your private key here to complete the security check. | fake_support, phishing |
| highRisk-13 | red | green / 10 | falseNegative | Before I order, send $20 to prove you are a real freelancer. I will refund it later. | payment_request |
| highRisk-14 | red | green / 25 | falseNegative | Pay the customs fee first and I will release your project payment afterward. | payment_request |
| highRisk-15 | red | green / 20 | falseNegative | Scan this QR code to confirm your seller account and receive the payment. | payment_request, phishing |
| highRisk-16 | red | yellow / 50 | undergraded | I already paid. Fiverr needs your email address before the payment can be released. | payment_request, external_contact, personal_information |
| highRisk-17 | red | yellow / 35 | undergraded | Download this ZIP and run the software inside to unlock your earnings. | malicious_download |
| highRisk-20 | red | yellow / 50 | undergraded | We are hiring freelancers. Pay our mandatory registration fee before you can start work. | payment_request, job_offer_scam |
| legitimateExternalContact-04 | green | yellow / 50 | falsePositive | Add a button labeled 'contact me on WhatsApp' to this fictional landing page. | off_platform_communication, external_contact, suspicious_link |
| legitimateExternalContact-06 | green | yellow / 30 | falsePositive | Do not move this conversation outside Fiverr or message me on Telegram. | off_platform_communication |
| legitimateExternalContact-09 | green | yellow / 30 | falsePositive | The newsletter template includes a support email and an unsubscribe link. | external_contact, fake_support, suspicious_link |
| legitimatePayment-02 | green | yellow / 40 | falsePositive | Please use the Fiverr order page for payment. | payment_request, suspicious_link |
| legitimatePayment-06 | green | yellow / 35 | falsePositive | Do not pay the verification fee requested by that suspicious buyer. | payment_request, fake_support |
| legitimatePayment-07 | green | yellow / 30 | falsePositive | Please design the checkout page with dummy card number and CVV fields. | external_contact, suspicious_link, personal_information |
| legitimatePayment-08 | green | yellow / 30 | falsePositive | The payment verification page in this mockup is a static illustration with no working form. | payment_request, fake_support, suspicious_link |
| legitimatePayment-10 | green | yellow / 45 | falsePositive | Please do not send payment directly to me; use the Fiverr checkout. | off_platform_payment, payment_request |
| links-02 | green | yellow / 50 | falsePositive | Read the official Fiverr payment help article: https://help.fiverr.com/hc/en-us/articles/example | payment_request, fake_support |
| links-03 | green | yellow / 55 | falsePositive | The GitHub documentation explains login security: https://docs.github.com/en/authentication | fake_support, phishing |
| links-05 | yellow | green / 25 | falseNegative | The brief is behind this shortened link: https://bit.ly/qa-brief-example | suspicious_link |
| links-06 | yellow | green / 10 | falseNegative | The project form is at http://forms.example/brief | suspicious_link |
| links-10 | red | yellow / 40 | undergraded | Pay the mandatory payout activation fee at https://payout.example/activate before you receive your earnings. | payment_request |
| unusualSpelling-03 | yellow | green / 10 | falseNegative | Pls cntct me on Telegram to discuss the brief. | off_platform_communication |
| unusualSpelling-04 | yellow | green / 0 | falseNegative | Message me on Wh4tsApp for project updates. |  |
| unusualSpelling-05 | red | green / 10 | falseNegative | Send ur passw0rd to verify ur seller account. | phishing |
| unusualSpelling-06 | red | green / 10 | falseNegative | Share the o t p you just received so I can release your funds. | payment_request |
| unusualSpelling-07 | red | green / 10 | falseNegative | Send your pass​word to receive the payment. | payment_request |
| unusualSpelling-08 | red | green / 10 | falseNegative | Pay the verifcation fee to unlock your earnngs. | payment_request |
| unusualSpelling-09 | red | green / 10 | falseNegative | Instal AnyDesk and give me controll of your computer. | malicious_download |
| unusualSpelling-10 | red | green / 10 | falseNegative | Send bitcion to my walet before I release the payout. | payment_request |
| emojis-03 | green | red / 60 | falsePositive | Do not share your password or OTP with anyone 🔒 | account_credentials |
| emojis-05 | yellow | green / 25 | falseNegative | Please send your phone number so we can talk 📞 | external_contact |
| emojis-08 | red | yellow / 45 | undergraded | Buy gift cards 🎁 and send me the codes to activate your seller account. | gift_card, phishing |
| emojis-09 | red | yellow / 45 | undergraded | Install AnyDesk 🖥️ and give me remote access for verification. | fake_support, malicious_download |
| mixedCase-03 | green | red / 60 | falsePositive | Do NoT ShArE YoUr PaSsWoRd Or OtP. | account_credentials |
| mixedCase-08 | red | yellow / 35 | undergraded | InStAlL AnYdEsK AnD GiVe Me ReMoTe AcCeSs. | malicious_download |
| mixedCase-09 | red | yellow / 35 | undergraded | PaY ThE VeRiFiCaTiOn FeE BeFoRe YoUr PaYoUt CaN Be ReLeAsEd. | payment_request, fake_support |
| multiSentence-02 | green | red / 75 | falsePositive | The buyer mentioned Telegram. Do not contact them there. Keep payment and communication on Fiverr. | off_platform_communication, payment_request, external_contact |
| multiSentence-03 | yellow | green / 10 | falseNegative | The brief is too long for this chat. I use Telegram. Please message me there. | off_platform_communication |
| multiSentence-04 | yellow | green / 20 | falseNegative | I cannot attach the reference here. My email address is in the profile. Please contact me there instead. | external_contact, personal_information |
| multiSentence-05 | red | green / 20 | falseNegative | You just received an OTP. I need it to unlock your order payment. Please send it to me. | payment_request, account_credentials |
| multiSentence-06 | red | green / 20 | falseNegative | Your password is needed for this check. Please share it with me. Then I can release the payout. | payment_request, account_credentials |
| multiSentence-07 | red | green / 10 | falseNegative | There is a mandatory activation fee. It is twenty dollars. Pay it to me before you can receive your earnings. | payment_request |
| multiSentence-08 | red | yellow / 35 | undergraded | I sent you an AnyDesk installer. Run it. Then give me the remote access code. | malicious_download |
| multiSentence-09 | red | yellow / 55 | undergraded | The order money is on hold. Buy a gift card. Send its redemption code to me to release the funds. | payment_request, gift_card, personal_information |

## All classifications

Every record's indicators, phrases/regex matches, URL evidence and combinations are in results.json.

| Case | Expected | Inline | Flag | Preview | Outcome | Message |
|---|---|---|---|---|---|---|
| legitimate-01 | green | green (0) | green (0) | green (0) | correct | Could you make the logo slightly larger on the homepage? |
| legitimate-02 | green | green (0) | green (0) | green (0) | correct | The first draft is attached to this Fiverr order for review. |
| legitimate-03 | green | green (0) | green (0) | green (0) | correct | Please deliver the source files and a transparent PNG. |
| legitimate-04 | green | green (0) | green (0) | green (0) | correct | Can you finish the revision by Friday afternoon? |
| legitimate-05 | green | green (0) | green (0) | green (0) | correct | I prefer the second concept with the rounded lettering. |
| legitimate-06 | green | green (0) | green (0) | green (0) | correct | Thank you for the delivery. Everything looks good. |
| legitimate-07 | green | green (0) | green (0) | green (0) | correct | Please use the brand colors from the attached brief. |
| legitimate-08 | green | green (0) | green (0) | green (0) | correct | The package includes two revisions and commercial use. |
| legitimate-09 | green | green (0) | green (0) | green (0) | correct | I will approve the milestone after checking the final draft. |
| legitimate-10 | green | green (0) | green (0) | green (0) | correct | Please keep our conversation and delivery on Fiverr. |
| legitimate-11 | green | red (100) | green (0) | green (0) | falsePositive | Never share your password or verification code with a buyer. |
| legitimate-12 | green | yellow (35) | green (0) | green (0) | falsePositive | Do not install AnyDesk or give anyone remote access for this order. |
| legitimate-13 | green | green (10) | green (0) | green (0) | correct | The password reset screen is a design mockup with no real user data. |
| legitimate-14 | green | green (10) | green (20) | green (20) | correct | This is urgent because our launch is tomorrow; please upload the draft here. |
| legitimate-15 | green | green (20) | green (0) | green (0) | correct | I need an illustration explaining why gift card scams are dangerous. |
| legitimate-16 | green | red (60) | red (96) | red (96) | falsePositive | The fictional character in the script says 'send your password'; please remove that line. |
| legitimate-17 | green | green (10) | green (0) | green (0) | correct | The security awareness poster must warn people about phishing. |
| legitimate-18 | green | green (10) | green (0) | green (0) | correct | We are hiring an illustrator through this Fiverr order, with no fees required from applicants. |
| legitimate-19 | green | yellow (35) | green (0) | green (0) | falsePositive | Do not pay any registration fee to someone claiming to offer you work. |
| legitimate-20 | green | green (0) | green (0) | green (0) | correct | Please send the editable icon files in the delivery section. |
| suspicious-01 | yellow | yellow (40) | yellow (35) | yellow (35) | correct | Contact me on Telegram to discuss the project. |
| suspicious-02 | yellow | yellow (35) | yellow (35) | yellow (35) | correct | Please send me your email address so we can talk elsewhere. |
| suspicious-03 | yellow | yellow (30) | green (0) | green (0) | correct | Can we move this conversation outside Fiverr? |
| suspicious-04 | yellow | green (25) | yellow (35) | yellow (35) | falseNegative | Share your phone number and I will call about the brief. |
| suspicious-05 | yellow | green (10) | yellow (35) | yellow (35) | falseNegative | Message my assistant on WhatsApp for the project requirements. |
| suspicious-06 | yellow | green (10) | green (0) | green (0) | falseNegative | Join my Discord server so we can coordinate the design. |
| suspicious-07 | yellow | green (10) | yellow (35) | yellow (35) | falseNegative | Let's chat on Skype about the next revision. |
| suspicious-08 | yellow | yellow (30) | green (0) | green (0) | correct | Send your Signal number so I can explain the work. |
| suspicious-09 | yellow | green (25) | yellow (35) | yellow (35) | falseNegative | Email me the next draft instead of uploading it here. |
| suspicious-10 | yellow | green (10) | yellow (35) | yellow (35) | falseNegative | DM me on Instagram to discuss the package. |
| suspicious-11 | yellow | yellow (30) | yellow (35) | yellow (35) | correct | Add me on Telegram; it is easier to send instructions there. |
| suspicious-12 | yellow | yellow (50) | green (0) | green (0) | correct | Continue this conversation elsewhere using my email address. |
| suspicious-13 | yellow | green (20) | green (0) | green (0) | falseNegative | Contact our project manager on WhatsApp before we discuss the scope. |
| suspicious-14 | yellow | green (20) | green (0) | green (0) | falseNegative | Please use Facebook Messenger for the next meeting. |
| suspicious-15 | yellow | green (10) | green (0) | green (0) | falseNegative | Give me your personal email for project updates. |
| suspicious-16 | yellow | green (10) | green (0) | green (0) | falseNegative | Could you send your mobile number rather than reply here? |
| suspicious-17 | yellow | yellow (30) | green (0) | green (0) | correct | Talk to me outside Fiverr once you have read the brief. |
| suspicious-18 | yellow | green (10) | yellow (35) | yellow (35) | falseNegative | Please reach me on Telegram at the username in my profile. |
| suspicious-19 | yellow | green (10) | yellow (35) | yellow (35) | falseNegative | We should connect via WhatsApp for faster replies. |
| suspicious-20 | yellow | green (20) | yellow (35) | yellow (35) | falseNegative | Send me your Discord handle so I can message you there. |
| highRisk-01 | red | red (70) | red (96) | red (96) | correct | Send me your Fiverr password so I can release your order payment. |
| highRisk-02 | red | red (70) | red (96) | red (96) | correct | Please share the OTP that just arrived on your phone. |
| highRisk-03 | red | yellow (40) | red (90) | red (90) | undergraded | Enter your card number and CVV on my verification page to receive your earnings. |
| highRisk-04 | red | red (100) | red (96) | red (96) | correct | I am Fiverr support. Give me your password and verification code now. |
| highRisk-05 | red | yellow (35) | red (90) | red (90) | undergraded | Install AnyDesk and give me remote access to your computer. |
| highRisk-06 | red | yellow (35) | red (100) | red (100) | undergraded | Pay a verification fee before your Fiverr payment can be released. |
| highRisk-07 | red | yellow (35) | red (75) | red (75) | undergraded | Send bitcoin to my wallet to unlock the money from your order. |
| highRisk-08 | red | yellow (45) | red (75) | red (75) | undergraded | Buy gift cards and send me the redemption codes to activate your seller account. |
| highRisk-09 | red | yellow (35) | red (70) | red (70) | undergraded | Pay outside Fiverr by transferring the money directly to my bank. |
| highRisk-10 | red | red (65) | red (80) | red (80) | correct | Upload your passport and social security number so I can verify your payout. |
| highRisk-11 | red | red (70) | red (96) | red (96) | correct | Send your GitHub access token so I can verify ownership of your account. |
| highRisk-12 | red | yellow (45) | red (96) | red (96) | undergraded | Paste your private key here to complete the security check. |
| highRisk-13 | red | green (10) | green (0) | red (75) | falseNegative | Before I order, send $20 to prove you are a real freelancer. I will refund it later. |
| highRisk-14 | red | green (25) | red (75) | red (75) | falseNegative | Pay the customs fee first and I will release your project payment afterward. |
| highRisk-15 | red | green (20) | red (65) | red (65) | falseNegative | Scan this QR code to confirm your seller account and receive the payment. |
| highRisk-16 | red | yellow (50) | red (70) | red (70) | undergraded | I already paid. Fiverr needs your email address before the payment can be released. |
| highRisk-17 | red | yellow (35) | red (65) | red (65) | undergraded | Download this ZIP and run the software inside to unlock your earnings. |
| highRisk-18 | red | red (65) | red (75) | red (75) | correct | Transfer USDT to complete account verification before you can withdraw. |
| highRisk-19 | red | red (100) | red (100) | red (100) | correct | Give me your bank account details and login password to process the refund. |
| highRisk-20 | red | yellow (50) | red (75) | red (75) | undergraded | We are hiring freelancers. Pay our mandatory registration fee before you can start work. |
| legitimateExternalContact-01 | green | green (20) | green (0) | green (0) | correct | The website footer should display the client's public office email. |
| legitimateExternalContact-02 | green | green (10) | green (0) | green (0) | correct | Please add a phone number field to the contact form mockup. |
| legitimateExternalContact-03 | green | green (20) | green (0) | green (0) | correct | The design includes WhatsApp and Telegram icons, not a request to contact me. |
| legitimateExternalContact-04 | green | yellow (50) | yellow (35) | yellow (35) | falsePositive | Add a button labeled 'contact me on WhatsApp' to this fictional landing page. |
| legitimateExternalContact-05 | green | green (10) | green (0) | green (0) | correct | Please design a Telegram notification illustration for the article. |
| legitimateExternalContact-06 | green | yellow (30) | green (0) | green (0) | falsePositive | Do not move this conversation outside Fiverr or message me on Telegram. |
| legitimateExternalContact-07 | green | green (20) | green (0) | green (0) | correct | Use the placeholder email address in the brochure; keep our replies on Fiverr. |
| legitimateExternalContact-08 | green | green (10) | green (0) | green (0) | correct | The Instagram logo needs to match the Facebook icon in the header. |
| legitimateExternalContact-09 | green | yellow (30) | green (0) | green (0) | falsePositive | The newsletter template includes a support email and an unsubscribe link. |
| legitimateExternalContact-10 | green | green (25) | yellow (35) | yellow (35) | correct | The sample dialog 'send me your phone number' belongs in the training comic. |
| legitimatePayment-01 | green | green (10) | green (0) | green (0) | correct | Your payment has been received through the Fiverr order. |
| legitimatePayment-02 | green | yellow (40) | red (65) | red (65) | falsePositive | Please use the Fiverr order page for payment. |
| legitimatePayment-03 | green | green (10) | green (0) | green (0) | correct | The invoice is attached for your accounting records. |
| legitimatePayment-04 | green | green (10) | green (0) | green (0) | correct | The refund was processed through Fiverr; no action is required. |
| legitimatePayment-05 | green | green (0) | green (0) | green (0) | correct | The package price includes two revisions and commercial use. |
| legitimatePayment-06 | green | yellow (35) | green (0) | green (0) | falsePositive | Do not pay the verification fee requested by that suspicious buyer. |
| legitimatePayment-07 | green | yellow (30) | green (0) | green (0) | falsePositive | Please design the checkout page with dummy card number and CVV fields. |
| legitimatePayment-08 | green | yellow (30) | red (65) | red (65) | falsePositive | The payment verification page in this mockup is a static illustration with no working form. |
| legitimatePayment-09 | green | green (20) | green (0) | green (0) | correct | We need icons for bank transfers, Bitcoin, and gift cards in a financial literacy poster. |
| legitimatePayment-10 | green | yellow (45) | green (0) | green (0) | falsePositive | Please do not send payment directly to me; use the Fiverr checkout. |
| links-01 | green | green (0) | green (0) | green (0) | correct | Here is the project reference image: https://assets.example/design.png |
| links-02 | green | yellow (50) | green (0) | green (0) | falsePositive | Read the official Fiverr payment help article: https://help.fiverr.com/hc/en-us/articles/example |
| links-03 | green | yellow (55) | green (0) | green (0) | falsePositive | The GitHub documentation explains login security: https://docs.github.com/en/authentication |
| links-04 | green | green (10) | green (0) | green (0) | correct | The portfolio is available at https://portfolio.example/work |
| links-05 | yellow | green (25) | green (15) | green (15) | falseNegative | The brief is behind this shortened link: https://bit.ly/qa-brief-example |
| links-06 | yellow | green (10) | green (10) | green (10) | falseNegative | The project form is at http://forms.example/brief |
| links-07 | red | red (100) | red (100) | red (100) | correct | Verify your Fiverr account and enter your password at https://fiverr-security.example/login |
| links-08 | red | red (100) | red (100) | red (100) | correct | Send your OTP using https://fiverr.com@verify.example/check to release your payment. |
| links-09 | red | red (100) | yellow (35) | yellow (35) | correct | Your account will be suspended unless you verify it immediately at https://tinyurl.com/qa-account-example |
| links-10 | red | yellow (40) | green (0) | green (0) | undergraded | Pay the mandatory payout activation fee at https://payout.example/activate before you receive your earnings. |
| unusualSpelling-01 | green | green (0) | green (0) | green (0) | correct | Thnks for the drft, the colours look grate. |
| unusualSpelling-02 | green | green (0) | green (0) | green (0) | correct | Pls make the heding a littl bigger in the mockup. |
| unusualSpelling-03 | yellow | green (10) | green (0) | green (0) | falseNegative | Pls cntct me on Telegram to discuss the brief. |
| unusualSpelling-04 | yellow | green (0) | green (0) | green (0) | falseNegative | Message me on Wh4tsApp for project updates. |
| unusualSpelling-05 | red | green (10) | green (0) | green (0) | falseNegative | Send ur passw0rd to verify ur seller account. |
| unusualSpelling-06 | red | green (10) | green (0) | green (0) | falseNegative | Share the o t p you just received so I can release your funds. |
| unusualSpelling-07 | red | green (10) | green (0) | green (0) | falseNegative | Send your pass​word to receive the payment. |
| unusualSpelling-08 | red | green (10) | green (0) | green (0) | falseNegative | Pay the verifcation fee to unlock your earnngs. |
| unusualSpelling-09 | red | green (10) | green (0) | green (0) | falseNegative | Instal AnyDesk and give me controll of your computer. |
| unusualSpelling-10 | red | green (10) | green (0) | green (0) | falseNegative | Send bitcion to my walet before I release the payout. |
| emojis-01 | green | green (0) | green (0) | green (0) | correct | Thanks for the excellent logo! 😊 |
| emojis-02 | green | green (0) | green (0) | green (0) | correct | Please make the blue circle a little larger 🔵 |
| emojis-03 | green | red (60) | green (0) | green (0) | falsePositive | Do not share your password or OTP with anyone 🔒 |
| emojis-04 | yellow | yellow (40) | yellow (35) | yellow (35) | correct | Contact me on Telegram for the brief 💬 |
| emojis-05 | yellow | green (25) | yellow (35) | yellow (35) | falseNegative | Please send your phone number so we can talk 📞 |
| emojis-06 | red | red (70) | red (96) | red (96) | correct | Send your password 🔑 to unlock your payment 💰 |
| emojis-07 | red | red (100) | red (100) | red (100) | correct | I am Fiverr support ✅ Share your OTP now 🚨 |
| emojis-08 | red | yellow (45) | red (75) | red (75) | undergraded | Buy gift cards 🎁 and send me the codes to activate your seller account. |
| emojis-09 | red | yellow (45) | red (90) | red (90) | undergraded | Install AnyDesk 🖥️ and give me remote access for verification. |
| emojis-10 | red | red (85) | red (100) | red (100) | correct | Pay the verification fee 💸 or your account will be suspended immediately ⏰ |
| mixedCase-01 | green | green (0) | green (0) | green (0) | correct | PlEaSe ReViEw ThE FiNaL DrAfT. |
| mixedCase-02 | green | green (10) | green (0) | green (0) | correct | THE INVOICE IS ATTACHED FOR YOUR RECORDS. |
| mixedCase-03 | green | red (60) | green (0) | green (0) | falsePositive | Do NoT ShArE YoUr PaSsWoRd Or OtP. |
| mixedCase-04 | yellow | yellow (40) | yellow (35) | yellow (35) | correct | CoNtAcT Me On TeLeGrAm FoR ThE BrIeF. |
| mixedCase-05 | yellow | yellow (35) | yellow (35) | yellow (35) | correct | SeNd Me YoUr EmAiL AdDrEsS So We CaN TaLk ThErE. |
| mixedCase-06 | red | red (70) | red (96) | red (96) | correct | SeNd Me YoUr PaSsWoRd To ReLeAsE PaYmEnT. |
| mixedCase-07 | red | red (100) | red (100) | red (100) | correct | THIS IS FIVERR SUPPORT. PROVIDE YOUR OTP IMMEDIATELY. |
| mixedCase-08 | red | yellow (35) | red (90) | red (90) | undergraded | InStAlL AnYdEsK AnD GiVe Me ReMoTe AcCeSs. |
| mixedCase-09 | red | yellow (35) | red (100) | red (100) | undergraded | PaY ThE VeRiFiCaTiOn FeE BeFoRe YoUr PaYoUt CaN Be ReLeAsEd. |
| mixedCase-10 | red | red (70) | red (75) | red (75) | correct | SEND BITCOIN TO MY WALLET TO UNLOCK YOUR ORDER PAYMENT. |
| multiSentence-01 | green | green (20) | green (0) | green (0) | correct | The prototype needs a login page. It must never collect real passwords. Please send the design file here. |
| multiSentence-02 | green | red (75) | green (0) | green (0) | falsePositive | The buyer mentioned Telegram. Do not contact them there. Keep payment and communication on Fiverr. |
| multiSentence-03 | yellow | green (10) | green (0) | green (0) | falseNegative | The brief is too long for this chat. I use Telegram. Please message me there. |
| multiSentence-04 | yellow | green (20) | green (0) | green (0) | falseNegative | I cannot attach the reference here. My email address is in the profile. Please contact me there instead. |
| multiSentence-05 | red | green (20) | green (0) | green (0) | falseNegative | You just received an OTP. I need it to unlock your order payment. Please send it to me. |
| multiSentence-06 | red | green (20) | green (0) | green (0) | falseNegative | Your password is needed for this check. Please share it with me. Then I can release the payout. |
| multiSentence-07 | red | green (10) | green (0) | green (0) | falseNegative | There is a mandatory activation fee. It is twenty dollars. Pay it to me before you can receive your earnings. |
| multiSentence-08 | red | yellow (35) | red (90) | red (90) | undergraded | I sent you an AnyDesk installer. Run it. Then give me the remote access code. |
| multiSentence-09 | red | yellow (55) | red (75) | red (75) | undergraded | The order money is on hold. Buy a gift card. Send its redemption code to me to release the funds. |
| multiSentence-10 | red | red (100) | red (100) | red (100) | correct | Never share your password with strangers. But send me your OTP now. I am from Fiverr support. |

## Reproduce

Run `node tests/fraud-qa-130.cjs` against the current working tree. Run `node tests/fraud-qa-130.cjs --snapshot` to reproduce the recorded source snapshot. results.json records SHA-256 hashes for the dataset and evaluated runtime files. Snapshot copies are QA artifacts and are not loaded by the extension.

This corpus is hand-selected and not statistically representative of Fiverr traffic. Some yellow/red policy boundaries need human adjudication. No URL is visited, no messages are sent, and no AI is used.
