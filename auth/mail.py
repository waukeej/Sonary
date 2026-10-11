import smtplib
import ssl
import math
from email.message import EmailMessage
from flask import current_app


class MailUnavailable(Exception):
    pass


def send_otp(address, code):
    config = current_app.config
    if not config.get('MAIL_HOST') or not config.get('MAIL_FROM'):
        raise MailUnavailable()
    try:
        if config['MAIL_USE_TLS'] and config['MAIL_USE_SSL']:
            raise MailUnavailable()
        port = int(config['MAIL_PORT'])
        timeout = float(config.get('MAIL_TIMEOUT', 10))
        if not 1 <= port <= 65535 or not math.isfinite(timeout) or not 0 < timeout <= 60:
            raise MailUnavailable()
        message = EmailMessage()
        message['Subject'] = 'Sonary — verification code'
        message['From'] = config['MAIL_FROM']
        message['To'] = address
        message.set_content(f'Your Sonary verification code: {code}\n'
                            'Expires in 10 minutes. Never share this code.\n'
                            'If you did not request it, ignore this message.')
        connection_type = smtplib.SMTP_SSL if config['MAIL_USE_SSL'] else smtplib.SMTP
        options = {'timeout': timeout}
        if config['MAIL_USE_SSL']:
            options['context'] = ssl.create_default_context()
        with connection_type(config['MAIL_HOST'], port, **options) as smtp:
            if config['MAIL_USE_TLS'] and not config['MAIL_USE_SSL']:
                smtp.starttls(context=ssl.create_default_context())
            if config.get('MAIL_USERNAME'):
                if not (config['MAIL_USE_TLS'] or config['MAIL_USE_SSL']):
                    raise MailUnavailable()
                smtp.login(config['MAIL_USERNAME'], config.get('MAIL_PASSWORD', ''))
            if smtp.send_message(message):
                raise MailUnavailable()
    except (OSError, smtplib.SMTPException, ValueError, TypeError):
        raise MailUnavailable() from None
