/**
 * Email translations for verification emails
 * Supports 20+ languages matching invite-email.translations.ts
 */

export interface VerificationEmailTranslation {
  subject: string;
  title: string;
  greeting: string;
  instruction: string;
  buttonText: string;
  linkIntro: string;
  expirationWarning: string;
  ignoreNote: string;
  footer: string;
}

/**
 * Verification email translations for all supported languages
 * Fallback to English if language not found
 */
export const verificationEmailTranslations: Record<string, VerificationEmailTranslation> = {
  en: {
    subject: 'Verify your email - Chamo',
    title: 'Chamo',
    greeting: 'Verify your email address',
    instruction: 'Thank you for signing up for Chamo! To complete your registration, please verify your email address by clicking the button below:',
    buttonText: 'Verify Email Address',
    linkIntro: 'Or copy and paste this link into your browser:',
    expirationWarning: 'This link expires in 24 hours',
    ignoreNote: "If you didn't create an account with Chamo, you can safely ignore this email.",
    footer: 'Family communication made simple.',
  },
  ja: {
    subject: 'メールアドレスの確認 - Chamo',
    title: 'Chamo',
    greeting: 'メールアドレスを確認してください',
    instruction: 'Chamoにご登録いただきありがとうございます！登録を完了するには、下のボタンをクリックしてメールアドレスを確認してください：',
    buttonText: 'メールアドレスを確認',
    linkIntro: 'または、このリンクをブラウザにコピーして貼り付けてください：',
    expirationWarning: 'このリンクは24時間後に期限切れになります',
    ignoreNote: 'Chamoでアカウントを作成していない場合は、このメールを無視してください。',
    footer: '家族のコミュニケーションをシンプルに。',
  },
  es: {
    subject: 'Verifica tu correo electrónico - Chamo',
    title: 'Chamo',
    greeting: 'Verifica tu dirección de correo electrónico',
    instruction: '¡Gracias por registrarte en Chamo! Para completar tu registro, por favor verifica tu dirección de correo electrónico haciendo clic en el botón de abajo:',
    buttonText: 'Verificar correo electrónico',
    linkIntro: 'O copia y pega este enlace en tu navegador:',
    expirationWarning: 'Este enlace expira en 24 horas',
    ignoreNote: 'Si no creaste una cuenta en Chamo, puedes ignorar este correo electrónico.',
    footer: 'Comunicación familiar simplificada.',
  },
  fr: {
    subject: 'Vérifiez votre email - Chamo',
    title: 'Chamo',
    greeting: 'Vérifiez votre adresse email',
    instruction: "Merci de vous être inscrit sur Chamo ! Pour terminer votre inscription, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous :",
    buttonText: "Vérifier l'adresse email",
    linkIntro: 'Ou copiez et collez ce lien dans votre navigateur :',
    expirationWarning: 'Ce lien expire dans 24 heures',
    ignoreNote: "Si vous n'avez pas créé de compte sur Chamo, vous pouvez ignorer cet email.",
    footer: 'La communication familiale simplifiée.',
  },
  de: {
    subject: 'Bestätige deine E-Mail - Chamo',
    title: 'Chamo',
    greeting: 'Bestätige deine E-Mail-Adresse',
    instruction: 'Vielen Dank für deine Anmeldung bei Chamo! Um deine Registrierung abzuschließen, bestätige bitte deine E-Mail-Adresse, indem du auf den Button unten klickst:',
    buttonText: 'E-Mail-Adresse bestätigen',
    linkIntro: 'Oder kopiere diesen Link und füge ihn in deinen Browser ein:',
    expirationWarning: 'Dieser Link läuft in 24 Stunden ab',
    ignoreNote: 'Wenn du kein Konto bei Chamo erstellt hast, kannst du diese E-Mail ignorieren.',
    footer: 'Familienkommunikation leicht gemacht.',
  },
  zh: {
    subject: '验证您的电子邮件 - Chamo',
    title: 'Chamo',
    greeting: '验证您的电子邮件地址',
    instruction: '感谢您注册 Chamo！请点击下面的按钮验证您的电子邮件地址以完成注册：',
    buttonText: '验证电子邮件地址',
    linkIntro: '或将此链接复制并粘贴到浏览器中：',
    expirationWarning: '此链接将在24小时后过期',
    ignoreNote: '如果您没有在 Chamo 创建账户，可以忽略此电子邮件。',
    footer: '让家庭沟通更简单。',
  },
  ko: {
    subject: '이메일 인증 - Chamo',
    title: 'Chamo',
    greeting: '이메일 주소를 인증해주세요',
    instruction: 'Chamo에 가입해 주셔서 감사합니다! 등록을 완료하려면 아래 버튼을 클릭하여 이메일 주소를 인증해주세요:',
    buttonText: '이메일 주소 인증',
    linkIntro: '또는 이 링크를 브라우저에 복사하여 붙여넣으세요:',
    expirationWarning: '이 링크는 24시간 후에 만료됩니다',
    ignoreNote: 'Chamo에서 계정을 만들지 않으셨다면 이 이메일을 무시하셔도 됩니다.',
    footer: '가족 커뮤니케이션을 간편하게.',
  },
  pt: {
    subject: 'Verifique seu email - Chamo',
    title: 'Chamo',
    greeting: 'Verifique seu endereço de email',
    instruction: 'Obrigado por se cadastrar no Chamo! Para completar seu registro, por favor verifique seu endereço de email clicando no botão abaixo:',
    buttonText: 'Verificar endereço de email',
    linkIntro: 'Ou copie e cole este link no seu navegador:',
    expirationWarning: 'Este link expira em 24 horas',
    ignoreNote: 'Se você não criou uma conta no Chamo, pode ignorar este email.',
    footer: 'Comunicação familiar simplificada.',
  },
  ru: {
    subject: 'Подтвердите вашу электронную почту - Chamo',
    title: 'Chamo',
    greeting: 'Подтвердите ваш адрес электронной почты',
    instruction: 'Спасибо за регистрацию в Chamo! Чтобы завершить регистрацию, пожалуйста, подтвердите свой адрес электронной почты, нажав на кнопку ниже:',
    buttonText: 'Подтвердить электронную почту',
    linkIntro: 'Или скопируйте эту ссылку и вставьте её в браузер:',
    expirationWarning: 'Эта ссылка истекает через 24 часа',
    ignoreNote: 'Если вы не создавали аккаунт в Chamo, можете проигнорировать это письмо.',
    footer: 'Семейное общение стало проще.',
  },
  ar: {
    subject: 'تحقق من بريدك الإلكتروني - Chamo',
    title: 'Chamo',
    greeting: 'تحقق من عنوان بريدك الإلكتروني',
    instruction: 'شكراً لتسجيلك في Chamo! لإكمال التسجيل، يرجى التحقق من عنوان بريدك الإلكتروني بالنقر على الزر أدناه:',
    buttonText: 'تحقق من البريد الإلكتروني',
    linkIntro: 'أو انسخ هذا الرابط والصقه في متصفحك:',
    expirationWarning: 'تنتهي صلاحية هذا الرابط خلال 24 ساعة',
    ignoreNote: 'إذا لم تقم بإنشاء حساب في Chamo، يمكنك تجاهل هذا البريد الإلكتروني.',
    footer: 'تواصل عائلي بسيط.',
  },
  it: {
    subject: 'Verifica la tua email - Chamo',
    title: 'Chamo',
    greeting: 'Verifica il tuo indirizzo email',
    instruction: 'Grazie per esserti registrato su Chamo! Per completare la registrazione, verifica il tuo indirizzo email cliccando il pulsante qui sotto:',
    buttonText: 'Verifica indirizzo email',
    linkIntro: 'Oppure copia e incolla questo link nel tuo browser:',
    expirationWarning: 'Questo link scade tra 24 ore',
    ignoreNote: 'Se non hai creato un account su Chamo, puoi ignorare questa email.',
    footer: 'Comunicazione familiare semplificata.',
  },
  nl: {
    subject: 'Verifieer je email - Chamo',
    title: 'Chamo',
    greeting: 'Verifieer je e-mailadres',
    instruction: 'Bedankt voor je aanmelding bij Chamo! Om je registratie te voltooien, verifieer je e-mailadres door op de onderstaande knop te klikken:',
    buttonText: 'E-mailadres verifiëren',
    linkIntro: 'Of kopieer en plak deze link in je browser:',
    expirationWarning: 'Deze link verloopt over 24 uur',
    ignoreNote: 'Als je geen account bij Chamo hebt aangemaakt, kun je deze e-mail negeren.',
    footer: 'Familiecommunicatie eenvoudig gemaakt.',
  },
  pl: {
    subject: 'Zweryfikuj swój email - Chamo',
    title: 'Chamo',
    greeting: 'Zweryfikuj swój adres email',
    instruction: 'Dziękujemy za rejestrację w Chamo! Aby dokończyć rejestrację, zweryfikuj swój adres email klikając przycisk poniżej:',
    buttonText: 'Zweryfikuj adres email',
    linkIntro: 'Lub skopiuj i wklej ten link do przeglądarki:',
    expirationWarning: 'Ten link wygasa za 24 godziny',
    ignoreNote: 'Jeśli nie zakładałeś konta w Chamo, możesz zignorować tę wiadomość.',
    footer: 'Komunikacja rodzinna prosto.',
  },
  tr: {
    subject: 'E-postanızı doğrulayın - Chamo',
    title: 'Chamo',
    greeting: 'E-posta adresinizi doğrulayın',
    instruction: "Chamo'ya kaydolduğunuz için teşekkürler! Kaydınızı tamamlamak için lütfen aşağıdaki düğmeye tıklayarak e-posta adresinizi doğrulayın:",
    buttonText: 'E-posta adresini doğrula',
    linkIntro: 'Veya bu linki kopyalayıp tarayıcınıza yapıştırın:',
    expirationWarning: 'Bu link 24 saat içinde geçerliliğini yitirecektir',
    ignoreNote: "Chamo'da hesap oluşturmadıysanız, bu e-postayı güvenle yok sayabilirsiniz.",
    footer: 'Aile iletişimi basitleştirildi.',
  },
  vi: {
    subject: 'Xác minh email của bạn - Chamo',
    title: 'Chamo',
    greeting: 'Xác minh địa chỉ email của bạn',
    instruction: 'Cảm ơn bạn đã đăng ký Chamo! Để hoàn tất đăng ký, vui lòng xác minh địa chỉ email của bạn bằng cách nhấp vào nút bên dưới:',
    buttonText: 'Xác minh địa chỉ email',
    linkIntro: 'Hoặc sao chép và dán liên kết này vào trình duyệt của bạn:',
    expirationWarning: 'Liên kết này sẽ hết hạn sau 24 giờ',
    ignoreNote: 'Nếu bạn không tạo tài khoản với Chamo, bạn có thể bỏ qua email này.',
    footer: 'Giao tiếp gia đình đơn giản hơn.',
  },
  th: {
    subject: 'ยืนยันอีเมลของคุณ - Chamo',
    title: 'Chamo',
    greeting: 'ยืนยันที่อยู่อีเมลของคุณ',
    instruction: 'ขอบคุณที่ลงทะเบียน Chamo! เพื่อดำเนินการลงทะเบียนให้เสร็จสมบูรณ์ กรุณายืนยันที่อยู่อีเมลของคุณโดยคลิกปุ่มด้านล่าง:',
    buttonText: 'ยืนยันที่อยู่อีเมล',
    linkIntro: 'หรือคัดลอกลิงก์นี้และวางในเบราว์เซอร์ของคุณ:',
    expirationWarning: 'ลิงก์นี้จะหมดอายุใน 24 ชั่วโมง',
    ignoreNote: 'หากคุณไม่ได้สร้างบัญชีกับ Chamo คุณสามารถเพิกเฉยต่ออีเมลนี้ได้',
    footer: 'การสื่อสารในครอบครัวง่ายขึ้น',
  },
  id: {
    subject: 'Verifikasi email Anda - Chamo',
    title: 'Chamo',
    greeting: 'Verifikasi alamat email Anda',
    instruction: 'Terima kasih telah mendaftar di Chamo! Untuk menyelesaikan pendaftaran, silakan verifikasi alamat email Anda dengan mengklik tombol di bawah:',
    buttonText: 'Verifikasi alamat email',
    linkIntro: 'Atau salin dan tempel tautan ini ke browser Anda:',
    expirationWarning: 'Tautan ini kedaluwarsa dalam 24 jam',
    ignoreNote: 'Jika Anda tidak membuat akun di Chamo, Anda dapat mengabaikan email ini.',
    footer: 'Komunikasi keluarga jadi lebih mudah.',
  },
  hi: {
    subject: 'अपना ईमेल सत्यापित करें - Chamo',
    title: 'Chamo',
    greeting: 'अपना ईमेल पता सत्यापित करें',
    instruction: 'Chamo में साइन अप करने के लिए धन्यवाद! अपना पंजीकरण पूरा करने के लिए, कृपया नीचे दिए गए बटन पर क्लिक करके अपना ईमेल पता सत्यापित करें:',
    buttonText: 'ईमेल पता सत्यापित करें',
    linkIntro: 'या इस लिंक को कॉपी करके अपने ब्राउज़र में पेस्ट करें:',
    expirationWarning: 'यह लिंक 24 घंटे में समाप्त हो जाएगा',
    ignoreNote: 'यदि आपने Chamo पर खाता नहीं बनाया है, तो आप इस ईमेल को अनदेखा कर सकते हैं।',
    footer: 'पारिवारिक संवाद को सरल बनाया।',
  },
  sv: {
    subject: 'Verifiera din e-post - Chamo',
    title: 'Chamo',
    greeting: 'Verifiera din e-postadress',
    instruction: 'Tack för att du registrerade dig på Chamo! För att slutföra din registrering, vänligen verifiera din e-postadress genom att klicka på knappen nedan:',
    buttonText: 'Verifiera e-postadress',
    linkIntro: 'Eller kopiera och klistra in den här länken i din webbläsare:',
    expirationWarning: 'Den här länken upphör att gälla om 24 timmar',
    ignoreNote: 'Om du inte skapade ett konto på Chamo kan du ignorera det här mejlet.',
    footer: 'Familjekommunikation förenklad.',
  },
  no: {
    subject: 'Bekreft e-posten din - Chamo',
    title: 'Chamo',
    greeting: 'Bekreft e-postadressen din',
    instruction: 'Takk for at du registrerte deg på Chamo! For å fullføre registreringen, vennligst bekreft e-postadressen din ved å klikke på knappen nedenfor:',
    buttonText: 'Bekreft e-postadresse',
    linkIntro: 'Eller kopier og lim inn denne lenken i nettleseren din:',
    expirationWarning: 'Denne lenken utløper om 24 timer',
    ignoreNote: 'Hvis du ikke opprettet en konto på Chamo, kan du trygt ignorere denne e-posten.',
    footer: 'Familiekommunikasjon forenklet.',
  },
};

/**
 * Get translation for a specific language with fallback to English
 */
export function getVerificationEmailTranslation(language: string): VerificationEmailTranslation {
  return verificationEmailTranslations[language] || verificationEmailTranslations['en'];
}
