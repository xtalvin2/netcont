import React, { useState } from 'react';
import { Phone, MessageSquare, CheckCircle, Mail, MapPin, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { PublicLayout } from '@/components/layouts/PublicLayout';
import { submitSupportRequest } from '@/lib/api';
import { toast } from 'sonner';

function validateNigerianPhone(phone: string) {
  return /^(0[7-9][01]\d{8})$/.test(phone);
}

export default function SupportPage() {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateNigerianPhone(phone)) {
      toast.error('Invalid phone number', { description: 'Enter an 11-digit Nigerian number' });
      return;
    }
    if (message.trim().length < 10) {
      toast.error('Message too short', { description: 'Please describe your issue in more detail' });
      return;
    }
    setLoading(true);
    try {
      await submitSupportRequest(phone, message.trim());
      setSubmitted(true);
      toast.success('Support request submitted!');
    } catch {
      toast.error('Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-12 md:py-16 max-w-4xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-800 text-foreground mb-3 text-balance">
            We're Here to <span className="text-primary">Help</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Having issues? Submit a support request and we'll get back to you promptly.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact Form */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-foreground text-base">
                <MessageSquare className="h-4 w-4 text-primary" />
                Send a Message
              </CardTitle>
            </CardHeader>
            <CardContent>
              {submitted ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8 space-y-3"
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15">
                    <CheckCircle className="h-7 w-7 text-green-400" />
                  </div>
                  <p className="font-700 text-foreground">Request Submitted!</p>
                  <p className="text-sm text-muted-foreground">We'll reach out to {phone} shortly.</p>
                  <Button variant="outline" size="sm" onClick={() => { setSubmitted(false); setPhone(''); setMessage(''); }} className="border-border text-muted-foreground mt-2">
                    Submit Another
                  </Button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-foreground text-sm">Phone Number</Label>
                    <Input
                      type="tel"
                      placeholder="08012345678"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      maxLength={11}
                      className="bg-muted border-input text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-foreground text-sm">Your Message</Label>
                    <Textarea
                      placeholder="Describe your issue or question..."
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      rows={5}
                      className="bg-muted border-input text-foreground placeholder:text-muted-foreground resize-none"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-primary-foreground font-700 hover:bg-secondary"
                  >
                    {loading ? 'Submitting...' : 'Submit Request'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Contact Info */}
          <div className="space-y-4">
            {[
              { icon: Phone, title: 'Phone Support', detail: '08000000000', sub: 'Mon–Sat, 8am–8pm WAT' },
              { icon: Mail, title: 'Email', detail: 'support@netconnect.ng', sub: 'We reply within 24 hours' },
              { icon: Clock, title: 'Operating Hours', detail: 'Mon–Sat: 8am–8pm', sub: 'Sun: 10am–5pm WAT' },
              { icon: MapPin, title: 'Service Area', detail: 'Lagos, Abuja, Port Harcourt', sub: 'Expanding to more cities' },
            ].map(({ icon: Icon, title, detail, sub }) => (
              <Card key={title} className="bg-card border-border">
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-600 text-foreground">{title}</p>
                    <p className="text-sm text-foreground/80 mt-0.5">{detail}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* FAQs */}
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <p className="text-sm font-600 text-foreground mb-3">Quick Help</p>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li>• <span className="text-foreground font-500">Payment not reflected?</span> Wait 2–5 min and refresh</li>
                  <li>• <span className="text-foreground font-500">Wrong number entered?</span> Contact us immediately</li>
                  <li>• <span className="text-foreground font-500">Slow connection?</span> Check signal strength</li>
                  <li>• <span className="text-foreground font-500">Session expired?</span> Purchase a new package</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
