import { Injectable, InternalServerErrorException } from '@nestjs/common';
import nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly EMAIL_LINK_TTL: number = 3600;
  private readonly INTERVAL_SENDING: number = 60;
  private readonly HOURLY_LIMIT_SENDING: number = 10;

  private transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  constructor() {}

  async sendVerificationEmail(to: string, token: string) {
    const confirmUrl = `http://localhost:4000/api/users/verify-email?token=${token}`;

    try {
      const info = await this.transporter.sendMail({
        from: `"FN2-Tube" <${process.env.GMAIL_USER}>`,
        to,
        subject: 'Confirm your email',
        html: `
              <p>Click the button below to confirm your email:</p>
              <a href="${confirmUrl}" style="
                display: inline-block;
                padding: 12px 24px;
                font-size: 16px;
                color: white;
                background-color: #007bff;
                text-decoration: none;
                border-radius: 5px;
              ">Verify Email</a>
            `,
      });

      return info;
    } catch (error) {
      throw new InternalServerErrorException(
        `Email sending failed: ${error.message}`,
      );
    }
  }
}
