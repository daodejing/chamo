/**
 * Story 1.13: Email translations for invite notification emails
 * Supports 20+ languages as per AC#5
 */

export interface InviteNotificationTranslation {
  subject: string;
  title: string;
  heading: string;
  intro: string;
  body: string;
  codeLabel: string;
  cta: string;
  note: string;
  footer: string;
}

/**
 * Invite notification email translations for all supported languages
 * Fallback to English if language not found
 */
export const inviteNotificationTranslations: Record<string, InviteNotificationTranslation> = {
  en: {
    subject: "You've been invited to join {familyName} on Chamo",
    title: "You've been invited to {familyName}!",
    heading: "You're invited!",
    intro: 'Join {familyName} on Chamo',
    body: "You've been invited to join {familyName} on Chamo - a secure family communication platform.",
    codeLabel: 'Your invite code:',
    cta: 'Accept invitation',
    note: "Don't have an account? You'll be able to create one when you accept the invitation.",
    footer: 'Family communication made simple.',
  },
  ja: {
    subject: 'Chamoで{familyName}に参加する招待があります',
    title: '{familyName}への招待があります！',
    heading: '招待されています！',
    intro: 'Chamoで{familyName}に参加しましょう',
    body: '{familyName}に参加するための招待が届きました。Chamoは安全な家族向けコミュニケーションアプリです。',
    codeLabel: '招待コード:',
    cta: '招待を受け入れる',
    note: 'アカウントをお持ちでない場合でも、招待を受け入れると作成できます。',
    footer: '家族のコミュニケーションをシンプルに。',
  },
  es: {
    subject: 'Te invitaron a unirte a {familyName} en Chamo',
    title: '¡Te invitaron a {familyName}!',
    heading: '¡Estás invitado!',
    intro: 'Únete a {familyName} en Chamo',
    body: 'Te invitaron a unirte a {familyName} en Chamo, una plataforma segura de comunicación familiar.',
    codeLabel: 'Tu código de invitación:',
    cta: 'Aceptar invitación',
    note: '¿No tienes cuenta? Podrás crearla al aceptar la invitación.',
    footer: 'Comunicación familiar simplificada.',
  },
  fr: {
    subject: 'Vous avez été invité à rejoindre {familyName} sur Chamo',
    title: 'Invitation à {familyName} !',
    heading: 'Vous êtes invité !',
    intro: 'Rejoignez {familyName} sur Chamo',
    body: 'Vous avez été invité à rejoindre {familyName} sur Chamo, une plateforme sécurisée de communication familiale.',
    codeLabel: "Votre code d'invitation :",
    cta: "Accepter l'invitation",
    note: "Pas de compte ? Vous pourrez en créer un en acceptant l'invitation.",
    footer: 'La communication familiale simplifiée.',
  },
  de: {
    subject: 'Sie wurden eingeladen, {familyName} auf Chamo beizutreten',
    title: 'Einladung zu {familyName}!',
    heading: 'Sie sind eingeladen!',
    intro: 'Treten Sie {familyName} auf Chamo bei',
    body: 'Sie wurden eingeladen, {familyName} auf Chamo beizutreten – einer sicheren Plattform für Familienkommunikation.',
    codeLabel: 'Ihr Einladungscode:',
    cta: 'Einladung annehmen',
    note: 'Noch kein Konto? Sie können eines erstellen, wenn Sie die Einladung annehmen.',
    footer: 'Familienkommunikation leicht gemacht.',
  },
  zh: {
    subject: '您已被邀请加入 {familyName} - Chamo',
    title: '邀请加入 {familyName}！',
    heading: '您已受邀！',
    intro: '加入 Chamo 的 {familyName}',
    body: '您已被邀请加入 Chamo 上的 {familyName}，这是一个安全的家庭沟通平台。',
    codeLabel: '您的邀请码：',
    cta: '接受邀请',
    note: '没有账户？接受邀请时即可创建。',
    footer: '让家庭沟通更简单。',
  },
  ko: {
    subject: 'Chamo에서 {familyName}에 초대되었습니다',
    title: '{familyName}에 대한 초대가 도착했습니다!',
    heading: '초대되었습니다!',
    intro: 'Chamo에서 {familyName}에 참여하세요',
    body: '{familyName}에 참여하도록 초대되었습니다. Chamo는 안전한 가족 커뮤니케이션 플랫폼입니다.',
    codeLabel: '초대 코드:',
    cta: '초대 수락',
    note: '계정이 없으신가요? 초대를 수락하면 만들 수 있습니다.',
    footer: '가족 커뮤니케이션을 간편하게.',
  },
  pt: {
    subject: 'Você foi convidado a entrar em {familyName} no Chamo',
    title: 'Convite para {familyName}!',
    heading: 'Você foi convidado!',
    intro: 'Junte-se a {familyName} no Chamo',
    body: 'Você foi convidado a entrar em {familyName} no Chamo, uma plataforma segura de comunicação familiar.',
    codeLabel: 'Seu código de convite:',
    cta: 'Aceitar convite',
    note: 'Não tem conta? Você poderá criar uma ao aceitar o convite.',
    footer: 'Comunicação familiar simplificada.',
  },
  ru: {
    subject: 'Вас пригласили присоединиться к {familyName} на Chamo',
    title: 'Приглашение в {familyName}!',
    heading: 'Вы приглашены!',
    intro: 'Присоединяйтесь к {familyName} на Chamo',
    body: 'Вас пригласили присоединиться к {familyName} на Chamo — безопасной платформе для семейного общения.',
    codeLabel: 'Ваш код приглашения:',
    cta: 'Принять приглашение',
    note: 'Нет аккаунта? Вы сможете создать его при принятии приглашения.',
    footer: 'Семейное общение стало проще.',
  },
  ar: {
    subject: 'تمت دعوتك للانضمام إلى {familyName} على Chamo',
    title: 'دعوة للانضمام إلى {familyName}!',
    heading: 'لقد تمت دعوتك!',
    intro: 'انضم إلى {familyName} على Chamo',
    body: 'تمت دعوتك للانضمام إلى {familyName} على Chamo، وهي منصة آمنة للتواصل العائلي.',
    codeLabel: 'رمز دعوتك:',
    cta: 'قبول الدعوة',
    note: 'لا تملك حسابًا؟ يمكنك إنشاء واحد عند قبول الدعوة.',
    footer: 'تواصل عائلي بسيط.',
  },
  it: {
    subject: 'Sei stato invitato a unirti a {familyName} su Chamo',
    title: 'Invito a {familyName}!',
    heading: 'Sei invitato!',
    intro: 'Unisciti a {familyName} su Chamo',
    body: 'Sei stato invitato a unirti a {familyName} su Chamo, una piattaforma sicura di comunicazione familiare.',
    codeLabel: 'Il tuo codice invito:',
    cta: "Accetta l'invito",
    note: "Non hai un account? Potrai crearne uno quando accetti l'invito.",
    footer: 'Comunicazione familiare semplificata.',
  },
  nl: {
    subject: 'Je bent uitgenodigd om {familyName} te joinen op Chamo',
    title: 'Uitnodiging voor {familyName}!',
    heading: 'Je bent uitgenodigd!',
    intro: 'Word lid van {familyName} op Chamo',
    body: 'Je bent uitgenodigd om je aan te sluiten bij {familyName} op Chamo, een veilig familiecommunicatieplatform.',
    codeLabel: 'Jouw uitnodigingscode:',
    cta: 'Uitnodiging accepteren',
    note: 'Nog geen account? Je kunt er een aanmaken wanneer je de uitnodiging accepteert.',
    footer: 'Familiecommunicatie eenvoudig gemaakt.',
  },
  pl: {
    subject: 'Zaproszono Cię do dołączenia do {familyName} w Chamo',
    title: 'Zaproszenie do {familyName}!',
    heading: 'Jesteś zaproszony!',
    intro: 'Dołącz do {familyName} w Chamo',
    body: 'Zaproszono Cię do dołączenia do {familyName} w Chamo, bezpiecznej platformie do komunikacji rodzinnej.',
    codeLabel: 'Twój kod zaproszenia:',
    cta: 'Akceptuj zaproszenie',
    note: 'Nie masz konta? Będziesz mógł je utworzyć, akceptując zaproszenie.',
    footer: 'Komunikacja rodzinna prosto.',
  },
  tr: {
    subject: "{familyName}'e katılmanız için Chamo'da davet edildiniz",
    title: '{familyName} için davet!',
    heading: 'Davetlisiniz!',
    intro: "Chamo'da {familyName}'e katılın",
    body: "{familyName}'e katılmanız için Chamo'da davet edildiniz. Chamo güvenli bir aile iletişim platformudur.",
    codeLabel: 'Davet kodunuz:',
    cta: 'Daveti kabul et',
    note: 'Hesabınız yok mu? Daveti kabul ederken bir hesap oluşturabilirsiniz.',
    footer: 'Aile iletişimi basitleştirildi.',
  },
  vi: {
    subject: 'Bạn được mời tham gia {familyName} trên Chamo',
    title: 'Lời mời tham gia {familyName}!',
    heading: 'Bạn đã được mời!',
    intro: 'Tham gia {familyName} trên Chamo',
    body: 'Bạn được mời tham gia {familyName} trên Chamo, một nền tảng giao tiếp gia đình an toàn.',
    codeLabel: 'Mã mời của bạn:',
    cta: 'Chấp nhận lời mời',
    note: 'Chưa có tài khoản? Bạn có thể tạo khi chấp nhận lời mời.',
    footer: 'Giao tiếp gia đình đơn giản hơn.',
  },
  th: {
    subject: 'คุณได้รับเชิญให้เข้าร่วม {familyName} บน Chamo',
    title: 'คำเชิญเข้าร่วม {familyName}!',
    heading: 'คุณได้รับคำเชิญ!',
    intro: 'เข้าร่วม {familyName} บน Chamo',
    body: 'คุณได้รับเชิญให้เข้าร่วม {familyName} บน Chamo แพลตฟอร์มสื่อสารสำหรับครอบครัวที่ปลอดภัย',
    codeLabel: 'รหัสคำเชิญของคุณ:',
    cta: 'ยอมรับคำเชิญ',
    note: 'ยังไม่มีบัญชีใช่ไหม? คุณสามารถสร้างได้เมื่อยอมรับคำเชิญ',
    footer: 'การสื่อสารในครอบครัวง่ายขึ้น',
  },
  id: {
    subject: 'Anda diundang untuk bergabung dengan {familyName} di Chamo',
    title: 'Undangan untuk {familyName}!',
    heading: 'Anda diundang!',
    intro: 'Bergabunglah dengan {familyName} di Chamo',
    body: 'Anda diundang untuk bergabung dengan {familyName} di Chamo, platform komunikasi keluarga yang aman.',
    codeLabel: 'Kode undangan Anda:',
    cta: 'Terima undangan',
    note: 'Belum punya akun? Anda dapat membuatnya saat menerima undangan.',
    footer: 'Komunikasi keluarga jadi lebih mudah.',
  },
  hi: {
    subject: '{familyName} में शामिल होने के लिए आपको Chamo पर आमंत्रित किया गया है',
    title: '{familyName} के लिए निमंत्रण!',
    heading: 'आप आमंत्रित हैं!',
    intro: 'Chamo पर {familyName} से जुड़ें',
    body: 'आपको Chamo पर {familyName} में शामिल होने के लिए आमंत्रित किया गया है, जो परिवारिक संचार का एक सुरक्षित मंच है।',
    codeLabel: 'आपका निमंत्रण कोड:',
    cta: 'निमंत्रण स्वीकार करें',
    note: 'खाता नहीं है? निमंत्रण स्वीकार करने पर आप एक बना सकते हैं।',
    footer: 'पारिवारिक संवाद को सरल बनाया।',
  },
  sv: {
    subject: 'Du har blivit inbjuden att gå med i {familyName} på Chamo',
    title: 'Inbjudan till {familyName}!',
    heading: 'Du är inbjuden!',
    intro: 'Gå med i {familyName} på Chamo',
    body: 'Du har blivit inbjuden att gå med i {familyName} på Chamo, en säker plattform för familjekommunikation.',
    codeLabel: 'Din inbjudningskod:',
    cta: 'Acceptera inbjudan',
    note: 'Har du inget konto? Du kan skapa ett när du accepterar inbjudan.',
    footer: 'Familjekommunikation förenklad.',
  },
  no: {
    subject: 'Du er invitert til å bli med i {familyName} på Chamo',
    title: 'Invitasjon til {familyName}!',
    heading: 'Du er invitert!',
    intro: 'Bli med i {familyName} på Chamo',
    body: 'Du er invitert til å bli med i {familyName} på Chamo, en sikker plattform for familiekommunikasjon.',
    codeLabel: 'Din invitasjonskode:',
    cta: 'Godta invitasjonen',
    note: 'Har du ikke konto? Du kan opprette en når du godtar invitasjonen.',
    footer: 'Familiekommunikasjon forenklet.',
  },
};

/**
 * Get translation for a specific language with fallback to English
 */
export function getInviteNotificationTranslation(language: string): InviteNotificationTranslation {
  return inviteNotificationTranslations[language] || inviteNotificationTranslations['en'];
}
