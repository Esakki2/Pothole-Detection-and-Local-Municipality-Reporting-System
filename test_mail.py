import smtplib
from email.message import EmailMessage

EMAIL_SENDER = "potholereporter3@gmail.com"
EMAIL_PASSWORD = "vyutstqkqzxaiwgd"  # Make sure this has no spaces!

EMAIL_RECEIVER = "desakki123@gmail.com"
subject = "Test Email"
body = "This is a test email."

msg = EmailMessage()
msg['From'] = EMAIL_SENDER
msg['To'] = EMAIL_RECEIVER
msg['Subject'] = subject
msg.set_content(body)

print("Connecting...")
with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
    print("Logging in...")
    smtp.login(EMAIL_SENDER, EMAIL_PASSWORD)
    print("Sending mail...")
    smtp.send_message(msg)
    print("Email sent successfully!")
