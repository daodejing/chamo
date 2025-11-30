/**
 * Story 1.13: Email translations for registration invite emails
 * Supports 20+ languages as per AC#5
 */

export interface InviteEmailTranslation {
  subject: string;
  greeting: string;
  intro: string;
  cta: string;
  note: string;
  footer: string;
}

/**
 * Registration invite email translations for all supported languages
 * Fallback to English if language not found
 */
export const inviteEmailTranslations: Record<string, InviteEmailTranslation> = {
  en: {
    subject: 'Complete registration to join {familyName} on Chamo',
    greeting: "You're almost there!",
    intro: '{inviterName} invited you to {familyName}',
    cta: 'Create your account',
    note: "You'll need this same email when accepting the invite so we can keep your encrypted keys in sync.",
    footer: 'Family communication made simple.',
  },
  ja: {
    subject: '{familyName}に参加するための登録を完了してください - Chamo',
    greeting: 'もう少しです！',
    intro: '{inviterName}さんがあなたを{familyName}に招待しました',
    cta: 'アカウントを作成',
    note: '招待を受け入れる際に、暗号鍵を同期するために同じメールアドレスが必要です。',
    footer: '家族のコミュニケーションをシンプルに。',
  },
  es: {
    subject: 'Completa tu registro para unirte a {familyName} en Chamo',
    greeting: '¡Ya casi está!',
    intro: '{inviterName} te invitó a {familyName}',
    cta: 'Crear tu cuenta',
    note: 'Necesitarás este mismo correo electrónico al aceptar la invitación para mantener tus claves encriptadas sincronizadas.',
    footer: 'Comunicación familiar simplificada.',
  },
  fr: {
    subject: 'Terminez votre inscription pour rejoindre {familyName} sur Chamo',
    greeting: 'Vous y êtes presque !',
    intro: '{inviterName} vous a invité à rejoindre {familyName}',
    cta: 'Créer votre compte',
    note: "Vous aurez besoin de cette même adresse e-mail lors de l'acceptation de l'invitation pour synchroniser vos clés chiffrées.",
    footer: 'La communication familiale simplifiée.',
  },
  de: {
    subject: 'Registrierung abschließen, um {familyName} auf Chamo beizutreten',
    greeting: 'Fast geschafft!',
    intro: '{inviterName} hat Sie zu {familyName} eingeladen',
    cta: 'Konto erstellen',
    note: 'Sie benötigen dieselbe E-Mail-Adresse, um die Einladung anzunehmen und Ihre verschlüsselten Schlüssel zu synchronisieren.',
    footer: 'Familienkommunikation leicht gemacht.',
  },
  zh: {
    subject: '完成注册以加入 {familyName} - Chamo',
    greeting: '即将完成！',
    intro: '{inviterName} 邀请您加入 {familyName}',
    cta: '创建账户',
    note: '接受邀请时需要使用相同的电子邮件地址，以便同步您的加密密钥。',
    footer: '让家庭沟通更简单。',
  },
  ko: {
    subject: '{familyName}에 가입하기 위한 등록을 완료하세요 - Chamo',
    greeting: '거의 다 되었습니다!',
    intro: '{inviterName}님이 {familyName}에 초대했습니다',
    cta: '계정 만들기',
    note: '초대를 수락할 때 암호화 키를 동기화하려면 동일한 이메일 주소가 필요합니다.',
    footer: '가족 커뮤니케이션을 간편하게.',
  },
  pt: {
    subject: 'Complete seu registro para entrar em {familyName} no Chamo',
    greeting: 'Quase lá!',
    intro: '{inviterName} convidou você para {familyName}',
    cta: 'Criar sua conta',
    note: 'Você precisará deste mesmo e-mail ao aceitar o convite para manter suas chaves criptografadas sincronizadas.',
    footer: 'Comunicação familiar simplificada.',
  },
  ru: {
    subject: 'Завершите регистрацию, чтобы присоединиться к {familyName} на Chamo',
    greeting: 'Почти готово!',
    intro: '{inviterName} приглашает вас в {familyName}',
    cta: 'Создать аккаунт',
    note: 'При принятии приглашения потребуется этот же адрес электронной почты для синхронизации ваших зашифрованных ключей.',
    footer: 'Семейное общение стало проще.',
  },
  ar: {
    subject: 'أكمل التسجيل للانضمام إلى {familyName} على Chamo',
    greeting: 'أنت على وشك الانتهاء!',
    intro: '{inviterName} دعاك للانضمام إلى {familyName}',
    cta: 'إنشاء حسابك',
    note: 'ستحتاج إلى نفس البريد الإلكتروني عند قبول الدعوة لمزامنة مفاتيح التشفير الخاصة بك.',
    footer: 'تواصل عائلي بسيط.',
  },
  it: {
    subject: 'Completa la registrazione per unirti a {familyName} su Chamo',
    greeting: 'Ci sei quasi!',
    intro: '{inviterName} ti ha invitato a {familyName}',
    cta: 'Crea il tuo account',
    note: "Avrai bisogno della stessa email quando accetti l'invito per mantenere sincronizzate le tue chiavi crittografate.",
    footer: 'Comunicazione familiare semplificata.',
  },
  nl: {
    subject: 'Voltooi je registratie om lid te worden van {familyName} op Chamo',
    greeting: 'Je bent er bijna!',
    intro: '{inviterName} heeft je uitgenodigd voor {familyName}',
    cta: 'Account aanmaken',
    note: 'Je hebt hetzelfde e-mailadres nodig bij het accepteren van de uitnodiging om je versleutelde sleutels gesynchroniseerd te houden.',
    footer: 'Familiecommunicatie eenvoudig gemaakt.',
  },
  pl: {
    subject: 'Dokończ rejestrację, aby dołączyć do {familyName} na Chamo',
    greeting: 'Już prawie!',
    intro: '{inviterName} zaprosił Cię do {familyName}',
    cta: 'Utwórz konto',
    note: 'Będziesz potrzebować tego samego adresu e-mail podczas akceptowania zaproszenia, aby zsynchronizować swoje zaszyfrowane klucze.',
    footer: 'Komunikacja rodzinna prosto.',
  },
  tr: {
    subject: "{familyName}'e katılmak için kaydınızı tamamlayın - Chamo",
    greeting: 'Neredeyse tamamlandı!',
    intro: "{inviterName} sizi {familyName}'e davet etti",
    cta: 'Hesap oluştur',
    note: 'Daveti kabul ederken şifreli anahtarlarınızı senkronize tutmak için aynı e-posta adresine ihtiyacınız olacak.',
    footer: 'Aile iletişimi basitleştirildi.',
  },
  vi: {
    subject: 'Hoàn tất đăng ký để tham gia {familyName} trên Chamo',
    greeting: 'Sắp xong rồi!',
    intro: '{inviterName} đã mời bạn tham gia {familyName}',
    cta: 'Tạo tài khoản',
    note: 'Bạn sẽ cần cùng email này khi chấp nhận lời mời để đồng bộ hóa khóa mã hóa của bạn.',
    footer: 'Giao tiếp gia đình đơn giản hơn.',
  },
  th: {
    subject: 'ลงทะเบียนให้เสร็จสมบูรณ์เพื่อเข้าร่วม {familyName} บน Chamo',
    greeting: 'เกือบเสร็จแล้ว!',
    intro: '{inviterName} เชิญคุณเข้าร่วม {familyName}',
    cta: 'สร้างบัญชี',
    note: 'คุณจะต้องใช้อีเมลเดียวกันเมื่อรับคำเชิญเพื่อซิงค์คีย์เข้ารหัสของคุณ',
    footer: 'การสื่อสารในครอบครัวง่ายขึ้น',
  },
  id: {
    subject: 'Selesaikan pendaftaran untuk bergabung dengan {familyName} di Chamo',
    greeting: 'Hampir selesai!',
    intro: '{inviterName} mengundang Anda ke {familyName}',
    cta: 'Buat akun Anda',
    note: 'Anda akan memerlukan email yang sama saat menerima undangan untuk menjaga kunci enkripsi Anda tetap sinkron.',
    footer: 'Komunikasi keluarga jadi lebih mudah.',
  },
  hi: {
    subject: '{familyName} में शामिल होने के लिए पंजीकरण पूरा करें - Chamo',
    greeting: 'लगभग हो गया!',
    intro: '{inviterName} ने आपको {familyName} में आमंत्रित किया है',
    cta: 'अपना खाता बनाएं',
    note: 'निमंत्रण स्वीकार करते समय आपको अपनी एन्क्रिप्टेड कुंजियों को सिंक रखने के लिए इसी ईमेल की आवश्यकता होगी।',
    footer: 'पारिवारिक संवाद को सरल बनाया।',
  },
  sv: {
    subject: 'Slutför registreringen för att gå med i {familyName} på Chamo',
    greeting: 'Du är nästan klar!',
    intro: '{inviterName} har bjudit in dig till {familyName}',
    cta: 'Skapa ditt konto',
    note: 'Du behöver samma e-postadress när du accepterar inbjudan för att synkronisera dina krypterade nycklar.',
    footer: 'Familjekommunikation förenklad.',
  },
  no: {
    subject: 'Fullfør registreringen for å bli med i {familyName} på Chamo',
    greeting: 'Du er nesten ferdig!',
    intro: '{inviterName} har invitert deg til {familyName}',
    cta: 'Opprett kontoen din',
    note: 'Du trenger samme e-postadresse når du godtar invitasjonen for å holde de krypterte nøklene dine synkronisert.',
    footer: 'Familiekommunikasjon forenklet.',
  },
};

/**
 * Get translation for a specific language with fallback to English
 */
export function getInviteEmailTranslation(language: string): InviteEmailTranslation {
  return inviteEmailTranslations[language] || inviteEmailTranslations['en'];
}

/**
 * Replace placeholders in translation string
 */
export function formatTranslation(
  text: string,
  replacements: Record<string, string>,
): string {
  let result = text;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}
