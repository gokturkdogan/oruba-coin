import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
}

export async function sendEmail(options: EmailOptions) {
  try {
    const { data, error } = await resend.emails.send({
      from: options.from || 'Oruba Coin <noreply@oruba-coin.com>',
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
    })

    if (error) {
      console.error('Resend error:', error)
      throw new Error(`Failed to send email: ${error.message}`)
    }

    return data
  } catch (error) {
    console.error('Email send error:', error)
    throw error
  }
}

// Helper function for sending welcome emails
export async function sendWelcomeEmail(email: string, name?: string) {
  return sendEmail({
    to: email,
    subject: 'Oruba Coin\'a Hoş Geldiniz! 🚀',
    html: `
      <!DOCTYPE html>
      <html lang="tr">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #1a1a1a;
              background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0f0f1e 100%);
              background-attachment: fixed;
              padding: 20px;
            }
            .email-container {
              max-width: 600px;
              margin: 0 auto;
              background: #ffffff;
              border-radius: 16px;
              overflow: hidden;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
              background-size: 200% 200%;
              animation: gradient 8s ease infinite;
              padding: 40px 30px;
              text-align: center;
              position: relative;
              overflow: hidden;
            }
            .header::before {
              content: '';
              position: absolute;
              top: -50%;
              left: -50%;
              width: 200%;
              height: 200%;
              background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
              animation: pulse 3s ease-in-out infinite;
            }
            .logo {
              font-size: 32px;
              font-weight: 700;
              color: #ffffff;
              text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
              margin-bottom: 10px;
              position: relative;
              z-index: 1;
            }
            .header h1 {
              font-size: 28px;
              font-weight: 600;
              color: #ffffff;
              margin: 0;
              position: relative;
              z-index: 1;
              text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            }
            .content {
              background: #ffffff;
              padding: 40px 30px;
            }
            .greeting {
              font-size: 18px;
              color: #1a1a1a;
              margin-bottom: 20px;
              font-weight: 500;
            }
            .content p {
              font-size: 16px;
              color: #4a4a4a;
              margin-bottom: 20px;
              line-height: 1.8;
            }
            .features {
              background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
              border-radius: 12px;
              padding: 25px;
              margin: 25px 0;
            }
            .features h3 {
              color: #667eea;
              font-size: 18px;
              margin-bottom: 15px;
              font-weight: 600;
            }
            .features ul {
              list-style: none;
              padding: 0;
            }
            .features li {
              padding: 8px 0;
              color: #4a4a4a;
              font-size: 15px;
            }
            .features li:before {
              content: '✓ ';
              color: #22c55e;
              font-weight: 700;
              margin-right: 8px;
            }
            .button-container {
              text-align: center;
              margin: 30px 0;
            }
            .button {
              display: inline-block;
              padding: 16px 40px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: #ffffff !important;
              text-decoration: none;
              border-radius: 12px;
              font-weight: 600;
              font-size: 16px;
              box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
              transition: all 0.3s ease;
              letter-spacing: 0.5px;
            }
            .button:hover {
              transform: translateY(-2px);
              box-shadow: 0 12px 24px rgba(102, 126, 234, 0.5);
            }
            .footer {
              background: #f8f9fa;
              padding: 30px;
              text-align: center;
              border-top: 1px solid #e9ecef;
            }
            .footer p {
              color: #6c757d;
              font-size: 12px;
              margin: 5px 0;
            }
            .social-links {
              margin-top: 20px;
            }
            .social-links a {
              display: inline-block;
              margin: 0 10px;
              color: #667eea;
              text-decoration: none;
              font-size: 14px;
            }
            @keyframes gradient {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            @keyframes pulse {
              0%, 100% { opacity: 0.5; transform: scale(1); }
              50% { opacity: 0.8; transform: scale(1.1); }
            }
            @media only screen and (max-width: 600px) {
              .content {
                padding: 30px 20px;
              }
              .header {
                padding: 30px 20px;
              }
              .logo {
                font-size: 28px;
              }
              .header h1 {
                font-size: 24px;
              }
              .button {
                padding: 14px 30px;
                font-size: 14px;
              }
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <div class="logo">🚀 Oruba Coin</div>
              <h1>Hoş Geldiniz!</h1>
            </div>
            <div class="content">
              <p class="greeting">Merhaba ${name || 'Değerli Kullanıcı'}, 👋</p>
              <p>Oruba Coin platformuna kaydolduğunuz için teşekkür ederiz! Artık gerçek zamanlı kripto para analiz araçlarına erişebilirsiniz.</p>
              
              <div class="features">
                <h3>✨ Platform Özellikleri</h3>
                <ul>
                  <li>Gerçek zamanlı kripto para fiyatları</li>
                  <li>Detaylı grafikler ve analiz araçları</li>
                  <li>Saatlik hacim takibi</li>
                  <li>Premium özellikler ve avantajlar</li>
                </ul>
              </div>
              
              <p>Premium üyelik ile daha fazla özellik ve avantajdan yararlanabilirsiniz:</p>
              <div class="button-container">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/premium" class="button">💎 Premium'a Geçiş Yapın</a>
              </div>
              
              <p style="margin-top: 30px;">Sorularınız için bizimle iletişime geçmekten çekinmeyin. İyi yatırımlar dileriz! 📈</p>
              <p style="margin-top: 10px; font-weight: 600; color: #667eea;">Oruba Coin Ekibi</p>
            </div>
            <div class="footer">
              <p><strong>Oruba Coin</strong> - Gerçek Zamanlı Kripto Para Analiz Platformu</p>
              <p>Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.</p>
              <div class="social-links">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}">Web Sitesi</a>
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/premium">Premium</a>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
  })
}

// Helper function for sending password reset emails
export async function sendPasswordResetEmail(email: string, resetToken: string) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`
  
  return sendEmail({
    to: email,
    subject: 'Şifre Sıfırlama - Oruba Coin 🔐',
    html: `
      <!DOCTYPE html>
      <html lang="tr">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #1a1a1a;
              background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0f0f1e 100%);
              background-attachment: fixed;
              padding: 20px;
            }
            .email-container {
              max-width: 600px;
              margin: 0 auto;
              background: #ffffff;
              border-radius: 16px;
              overflow: hidden;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
              background-size: 200% 200%;
              animation: gradient 8s ease infinite;
              padding: 40px 30px;
              text-align: center;
              position: relative;
              overflow: hidden;
            }
            .header::before {
              content: '';
              position: absolute;
              top: -50%;
              left: -50%;
              width: 200%;
              height: 200%;
              background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
              animation: pulse 3s ease-in-out infinite;
            }
            .logo {
              font-size: 32px;
              font-weight: 700;
              color: #ffffff;
              text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
              margin-bottom: 10px;
              position: relative;
              z-index: 1;
            }
            .header h1 {
              font-size: 28px;
              font-weight: 600;
              color: #ffffff;
              margin: 0;
              position: relative;
              z-index: 1;
              text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            }
            .content {
              background: #ffffff;
              padding: 40px 30px;
            }
            .content p {
              font-size: 16px;
              color: #4a4a4a;
              margin-bottom: 20px;
              line-height: 1.8;
            }
            .button-container {
              text-align: center;
              margin: 30px 0;
            }
            .button {
              display: inline-block;
              padding: 16px 40px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: #ffffff !important;
              text-decoration: none;
              border-radius: 12px;
              font-weight: 600;
              font-size: 16px;
              box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
              transition: all 0.3s ease;
              letter-spacing: 0.5px;
            }
            .button:hover {
              transform: translateY(-2px);
              box-shadow: 0 12px 24px rgba(102, 126, 234, 0.5);
            }
            .warning-box {
              background: linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%);
              border-left: 4px solid #ffc107;
              border-radius: 8px;
              padding: 20px;
              margin: 30px 0;
              box-shadow: 0 4px 12px rgba(255, 193, 7, 0.15);
            }
            .warning-box strong {
              color: #856404;
              display: block;
              margin-bottom: 8px;
              font-size: 16px;
            }
            .warning-box p {
              color: #856404;
              margin: 0;
              font-size: 14px;
            }
            .link-fallback {
              background: #f8f9fa;
              border-radius: 8px;
              padding: 15px;
              margin: 20px 0;
              word-break: break-all;
              font-size: 12px;
              color: #667eea;
              border: 1px solid #e9ecef;
            }
            .footer {
              background: #f8f9fa;
              padding: 30px;
              text-align: center;
              border-top: 1px solid #e9ecef;
            }
            .footer p {
              color: #6c757d;
              font-size: 12px;
              margin: 5px 0;
            }
            .social-links {
              margin-top: 20px;
            }
            .social-links a {
              display: inline-block;
              margin: 0 10px;
              color: #667eea;
              text-decoration: none;
              font-size: 14px;
            }
            @keyframes gradient {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            @keyframes pulse {
              0%, 100% { opacity: 0.5; transform: scale(1); }
              50% { opacity: 0.8; transform: scale(1.1); }
            }
            @media only screen and (max-width: 600px) {
              .content {
                padding: 30px 20px;
              }
              .header {
                padding: 30px 20px;
              }
              .logo {
                font-size: 28px;
              }
              .header h1 {
                font-size: 24px;
              }
              .button {
                padding: 14px 30px;
                font-size: 14px;
              }
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <div class="logo">🔐 Oruba Coin</div>
              <h1>Şifre Sıfırlama</h1>
            </div>
            <div class="content">
              <p>Merhaba,</p>
              <p>Hesabınız için şifre sıfırlama talebinde bulundunuz. Yeni şifrenizi belirlemek için aşağıdaki butona tıklayın:</p>
              
              <div class="button-container">
                <a href="${resetUrl}" class="button">🔑 Şifremi Sıfırla</a>
              </div>
              
              <div class="warning-box">
                <strong>⚠️ Güvenlik Uyarısı</strong>
                <p>Bu şifre sıfırlama linki <strong>1 saat</strong> içinde geçerliliğini yitirecektir. Eğer şifre sıfırlama talebinde bulunmadıysanız, bu e-postayı görmezden gelebilirsiniz. Hesabınız güvende kalacaktır.</p>
              </div>
              
              <p>Buton çalışmıyorsa, aşağıdaki linki tarayıcınıza kopyalayıp yapıştırabilirsiniz:</p>
              <div class="link-fallback">${resetUrl}</div>
              
              <p style="margin-top: 30px;">Güvenlik için şifrenizi düzenli olarak değiştirmenizi öneririz. İyi günler dileriz! 🔒</p>
              <p style="margin-top: 10px; font-weight: 600; color: #667eea;">Oruba Coin Ekibi</p>
            </div>
            <div class="footer">
              <p><strong>Oruba Coin</strong> - Gerçek Zamanlı Kripto Para Analiz Platformu</p>
              <p>Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.</p>
              <div class="social-links">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}">Web Sitesi</a>
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/premium">Premium</a>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
  })
}

// Helper function for sending email verification emails
export async function sendVerificationEmail(email: string, verificationToken: string, name?: string) {
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`
  
  return sendEmail({
    to: email,
    from: process.env.EMAIL_FROM || 'Oruba Coin <noreply@oruba-coin.com>',
    subject: 'E-posta Adresinizi Doğrulayın - Oruba Coin',
    html: `
      <!DOCTYPE html>
      <html lang="tr">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #1a1a1a;
              background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0f0f1e 100%);
              background-attachment: fixed;
              padding: 20px;
            }
            .email-container {
              max-width: 600px;
              margin: 0 auto;
              background: #ffffff;
              border-radius: 16px;
              overflow: hidden;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
              background-size: 200% 200%;
              animation: gradient 8s ease infinite;
              padding: 40px 30px;
              text-align: center;
              position: relative;
              overflow: hidden;
            }
            .header::before {
              content: '';
              position: absolute;
              top: -50%;
              left: -50%;
              width: 200%;
              height: 200%;
              background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
              animation: pulse 3s ease-in-out infinite;
            }
            .logo {
              font-size: 32px;
              font-weight: 700;
              color: #ffffff;
              text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
              margin-bottom: 10px;
              position: relative;
              z-index: 1;
            }
            .header h1 {
              font-size: 28px;
              font-weight: 600;
              color: #ffffff;
              margin: 0;
              position: relative;
              z-index: 1;
              text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            }
            .content {
              background: #ffffff;
              padding: 40px 30px;
            }
            .greeting {
              font-size: 18px;
              color: #1a1a1a;
              margin-bottom: 20px;
              font-weight: 500;
            }
            .content p {
              font-size: 16px;
              color: #4a4a4a;
              margin-bottom: 20px;
              line-height: 1.8;
            }
            .button-container {
              text-align: center;
              margin: 30px 0;
            }
            .button {
              display: inline-block;
              padding: 16px 40px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: #ffffff !important;
              text-decoration: none;
              border-radius: 12px;
              font-weight: 600;
              font-size: 16px;
              box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
              transition: all 0.3s ease;
              letter-spacing: 0.5px;
            }
            .button:hover {
              transform: translateY(-2px);
              box-shadow: 0 12px 24px rgba(102, 126, 234, 0.5);
            }
            .warning-box {
              background: linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%);
              border-left: 4px solid #ffc107;
              border-radius: 8px;
              padding: 20px;
              margin: 30px 0;
              box-shadow: 0 4px 12px rgba(255, 193, 7, 0.15);
            }
            .warning-box strong {
              color: #856404;
              display: block;
              margin-bottom: 8px;
              font-size: 16px;
            }
            .warning-box p {
              color: #856404;
              margin: 0;
              font-size: 14px;
            }
            .link-fallback {
              background: #f8f9fa;
              border-radius: 8px;
              padding: 15px;
              margin: 20px 0;
              word-break: break-all;
              font-size: 12px;
              color: #667eea;
              border: 1px solid #e9ecef;
            }
            .footer {
              background: #f8f9fa;
              padding: 30px;
              text-align: center;
              border-top: 1px solid #e9ecef;
            }
            .footer p {
              color: #6c757d;
              font-size: 12px;
              margin: 5px 0;
            }
            .social-links {
              margin-top: 20px;
            }
            .social-links a {
              display: inline-block;
              margin: 0 10px;
              color: #667eea;
              text-decoration: none;
              font-size: 14px;
            }
            @keyframes gradient {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            @keyframes pulse {
              0%, 100% { opacity: 0.5; transform: scale(1); }
              50% { opacity: 0.8; transform: scale(1.1); }
            }
            @media only screen and (max-width: 600px) {
              .content {
                padding: 30px 20px;
              }
              .header {
                padding: 30px 20px;
              }
              .logo {
                font-size: 28px;
              }
              .header h1 {
                font-size: 24px;
              }
              .button {
                padding: 14px 30px;
                font-size: 14px;
              }
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <div class="logo">🚀 Oruba Coin</div>
              <h1>E-posta Adresinizi Doğrulayın</h1>
            </div>
            <div class="content">
              <p class="greeting">Merhaba ${name || 'Değerli Kullanıcı'}, 👋</p>
              <p>Oruba Coin platformuna kaydolduğunuz için teşekkür ederiz! Kripto para analiz araçlarımıza erişmek için son bir adım kaldı.</p>
              <p>Hesabınızı aktifleştirmek için e-posta adresinizi doğrulamanız gerekmektedir. Aşağıdaki butona tıklayarak doğrulama işlemini tamamlayabilirsiniz:</p>
              
              <div class="button-container">
                <a href="${verificationUrl}" class="button">✓ E-posta Adresimi Doğrula</a>
              </div>
              
              <div class="warning-box">
                <strong>⚠️ Önemli Bilgi</strong>
                <p>Bu doğrulama linki <strong>24 saat</strong> içinde geçerliliğini yitirecektir. Eğer hesap oluşturmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
              </div>
              
              <p>Buton çalışmıyorsa, aşağıdaki linki tarayıcınıza kopyalayıp yapıştırabilirsiniz:</p>
              <div class="link-fallback">${verificationUrl}</div>
              
              <p style="margin-top: 30px;">Sorularınız için bizimle iletişime geçmekten çekinmeyin. İyi yatırımlar dileriz! 📈</p>
              <p style="margin-top: 10px; font-weight: 600; color: #667eea;">Oruba Coin Ekibi</p>
            </div>
            <div class="footer">
              <p><strong>Oruba Coin</strong> - Gerçek Zamanlı Kripto Para Analiz Platformu</p>
              <p>Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.</p>
              <div class="social-links">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}">Web Sitesi</a>
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/premium">Premium</a>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
  })
}

export { resend }


