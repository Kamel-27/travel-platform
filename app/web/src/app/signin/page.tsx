"use client";

import { useEffect, useState } from "react";
import Link from "next/link";


export default function SigninPage() {

  useEffect(() => {
    // Particles background
    const canvas = document.getElementById('particlesCanvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    if (!ctx) return;
    const particles: Particle[] = [];
    let animationFrame: number;

    function initCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    class Particle {
      x!: number;
      y!: number;
      size!: number;
      speedX!: number;
      speedY!: number;
      opacity!: number;

      constructor() {
        this.reset();
      }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 1;
        this.speedX = (Math.random() - 0.5) * 0.5;
        this.speedY = (Math.random() - 0.5) * 0.5;
        this.opacity = Math.random() * 0.5;
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
          this.reset();
        }
      }
      draw() {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = 0; i < 50; i++) {
      particles.push(new Particle());
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      animationFrame = requestAnimationFrame(animate);
    }

    window.addEventListener('resize', initCanvas);
    initCanvas();
    animate();

    return () => {
      window.removeEventListener('resize', initCanvas);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    alert('تم تسجيل الدخول بنجاح بنسخة العرض!');
    window.location.href = '/user-dashboard';
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden bg-background">
      
      <div className="absolute inset-0 z-0 bg-login-hero" data-alt="A breathtaking wide-angle view of a modern airplane wing soaring above a sea of soft white clouds during a golden hour sunset. The horizon is painted with vibrant oranges, deep blues, and warm purples, reflecting the premium travel aesthetic of Safariyat. The lighting is cinematic and inspiring, capturing the essence of luxury global exploration. The overall atmosphere is serene and high-velocity, emphasizing the thrill of discovery and the reliability of a high-end travel service.">
      </div>

      <main className="z-10 w-full max-w-md px-4 md:px-0 relative flex flex-col items-center justify-center">
        <div className="w-full glass-panel rounded-xl shadow-lg p-md md:p-xl flex flex-col gap-md border border-outline-variant/30">

          <div className="flex flex-col items-center gap-xs">
            <Link href="/" className="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold text-primary hover:opacity-80 transition-opacity">
              سفريات
            </Link>
            <p className="font-body-md text-body-md text-on-surface-variant text-center">أهلاً بك مجدداً! رحلتك القادمة تبدأ من هنا.</p>
          </div>

          <form className="flex flex-col gap-base" onSubmit={handleSubmit}>

            <div className="flex flex-col gap-xs">
              <label className="font-label-md text-label-md text-on-surface" htmlFor="email">البريد الإلكتروني</label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute right-3 text-outline" data-icon="mail">mail</span>
                <input className="w-full pr-10 pl-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-body-md text-body-md" id="email" placeholder="example@domain.com" required type="email"/>
              </div>
            </div>

            <div className="flex flex-col gap-xs">
              <div className="flex justify-between items-center">
                <label className="font-label-md text-label-md text-on-surface" htmlFor="password">كلمة المرور</label>
                <Link className="font-label-sm text-label-sm text-primary hover:underline transition-all" href="/support">نسيت كلمة المرور؟</Link>
              </div>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute right-3 text-outline" data-icon="lock">lock</span>
                <input className="w-full pr-10 pl-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-body-md text-body-md" id="password" placeholder="••••••••" required type="password"/>
              </div>
            </div>

            <button className="w-full mt-base bg-tertiary-container hover:bg-tertiary transition-all duration-300 py-4 rounded-lg font-headline-md text-on-tertiary-container shadow-md active:scale-98 cursor-pointer" type="submit">
              تسجيل الدخول
            </button>
          </form>

          <div className="flex items-center gap-base">
            <div className="h-px flex-1 bg-outline-variant"></div>
            <span className="font-label-sm text-label-sm text-on-surface-variant">أو سجل عبر</span>
            <div className="h-px flex-1 bg-outline-variant"></div>
          </div>

          <div className="flex gap-base">
            <button className="flex-1 flex items-center justify-center gap-xs py-3 bg-white border border-outline-variant rounded-lg hover:bg-surface-container-low transition-all active:scale-95 shadow-sm cursor-pointer">
              <img alt="Google" className="w-5 h-5" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDxnYgn4JLW0_y7H-9Rbt15HgYk-IsNxyrB9weIh2EaUn9empenMbKl1qLbB9VAnb-zD6OEckPJ0FXQP1AV78ir0KL7e-WMs1fXMqSHGwVdFxWyGgVCQ2SDHnl0nV2Qd6BwvYQGSM2PyJrE2l74rVI5tIN2oGYeAFlvexAszoIvJzsoFqjPCAx3YyU0etmR3OC-k-7U-m_xfu59M1Nd3OSMEqT-Q0cbetLwujCkYkTXHx4cnGnCf9RUj4xeupkQTCNXbfOOe_KF5RW1"/>
              <span className="font-label-md text-label-md text-secondary">جوجل</span>
            </button>
            <button className="flex-1 flex items-center justify-center gap-xs py-3 bg-white border border-outline-variant rounded-lg hover:bg-surface-container-low transition-all active:scale-95 shadow-sm cursor-pointer">
              <span className="material-symbols-outlined text-[20px]" data-icon="apple" style={{ fontVariationSettings: "'FILL' 1" }}>ios</span>
              <span className="font-label-md text-label-md text-secondary">آبل</span>
            </button>
          </div>

          <div className="text-center mt-base">
            <p className="font-body-md text-body-md text-on-surface-variant">ليس لديك حساب؟ 
              <Link className="text-primary font-bold hover:underline transition-all mr-1" href="/signup">إنشاء حساب جديد</Link>
            </p>
          </div>
        </div>

        <footer className="mt-xl text-center">
          <div className="flex justify-center gap-md mb-base">
            <Link className="font-label-sm text-label-sm text-white/80 hover:text-white transition-colors" href="/">عن سفريات</Link>
            <Link className="font-label-sm text-label-sm text-white/80 hover:text-white transition-colors" href="/">الشروط والأحكام</Link>
            <Link className="font-label-sm text-label-sm text-white/80 hover:text-white transition-colors" href="/support">اتصل بنا</Link>
          </div>
          <p className="font-label-sm text-label-sm text-white/60">© 2026 سفريات. جميع الحقوق محفوظة.</p>
        </footer>
      </main>

      <canvas className="absolute inset-0 pointer-events-none opacity-40" id="particlesCanvas"></canvas>
    </div>
  );
}
