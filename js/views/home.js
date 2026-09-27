// Home / Bundles landing. Desktop follows Home_Desktop.png (+ benefits/band from home_desktop2.png);
// mobile follows "mobile sample view.png". Sections use order-* so one DOM serves both sequences.
import { icon, arrowLink, checkItem, chips, productCardRow, productCardTile, categoryCard, featuredPackageCard, esc } from '../components.js';
import { products, showcaseCategories as categories, testimonials } from '../data/products.js';

const MOCKUP_CHIPS = ['beverages', 'supplements', 'personal-care', 'food'];

const trust = [
  ['sprout', 'Natural', 'Products'],
  ['heart', 'Healthy', 'Lifestyle'],
  ['people', 'Global', 'Opportunity'],
  ['shield', 'Trusted', 'Worldwide'],
];

const hero = () => `
  <section class="order-1 relative">
    <div class="hero-scene relative overflow-hidden h-[560px] sm:h-[620px] lg:h-[392px]">
      <div class="hero-shade absolute inset-0"></div>
      <div class="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/55 to-transparent lg:hidden"></div>
      <div class="relative mx-auto max-w-[1480px] h-full px-6 lg:px-10 flex flex-col pt-7 lg:pt-9 pb-6 lg:pb-9">
        <h1 class="lg:font-script font-extrabold lg:font-normal text-[30px] sm:text-[36px] lg:text-[54px] xl:text-[58px] leading-[1.1] lg:leading-[1.12] tracking-[-0.01em] text-ink lg:text-white lg:[text-shadow:0_2px_18px_rgba(0,0,0,.25)]">
          Better Health<br><span class="text-brand lg:text-white lg:pl-1">A Brighter Tomorrow</span>
        </h1>
        <p class="mt-3 lg:mt-4 text-[13.5px] lg:text-[16px] leading-snug text-ink lg:text-white max-w-[210px] lg:max-w-[340px] lg:[text-shadow:0_1px_8px_rgba(0,0,0,.35)]">
          Premium DXN products. Real opportunities. Build a healthier you and your family.
        </p>
        <ul class="mt-auto lg:mt-7 grid grid-cols-3 lg:flex gap-2 lg:gap-4 text-white">
          ${trust.map(([ic, a, b], i) => `
            <li class="${i === 3 ? 'hidden lg:flex' : 'flex'} flex-col items-center text-center gap-2 lg:w-[78px]">
              <span class="trust-ring bg-white/10 backdrop-blur-[2px]">${icon(ic, 'w-6 h-6', 1.6)}</span>
              <span class="text-[11px] lg:text-[10.5px] leading-tight font-semibold tracking-wide uppercase [text-shadow:0_1px_6px_rgba(0,0,0,.45)]">${a}<br>${b}</span>
            </li>`).join('')}
        </ul>
      </div>
      <div class="hidden lg:block absolute top-[14px] right-[max(1.5rem,calc((100vw_-_1480px)/2_+_2.5rem))] w-[392px]">
        ${featuredPackageCard()}
      </div>
    </div>
    <div class="lg:hidden relative z-10 -mt-3 px-3 pt-6 bg-white rounded-t-[18px]">
      ${featuredPackageCard()}
    </div>
  </section>`;

const whyChoose = () => `
  <section class="order-2 lg:hidden px-4 pt-8 pb-4 bg-white">
    <h2 class="text-[21px] font-extrabold mb-4">Why Choose DXN?</h2>
    <div class="grid grid-cols-2 gap-3">
      ${[['sprout', 'Premium<br>Quality'], ['globe', 'Trusted<br>Worldwide'], ['shield', 'Safe &amp;<br>Natural'], ['heart', 'Supports<br>Your Wellness']]
        .map(([ic, t]) => `<div class="card flex flex-col items-center text-center gap-2 py-5">${icon(ic, 'w-7 h-7 text-brand', 1.5)}<span class="text-[13px] text-ink-soft leading-snug">${t}</span></div>`).join('')}
    </div>
  </section>`;

const promos = () => `
  <section class="order-4 lg:order-2 mx-auto w-full max-w-[1480px] px-3 lg:px-10 pt-4 lg:pt-5 grid lg:grid-cols-[1.3fr_1fr] gap-4 lg:gap-5">
    <!-- Create your own bundle -->
    <article class="relative overflow-hidden rounded-[16px] bg-brand-soft shadow-[var(--shadow-1)] lg:min-h-[214px] flex">
      <img src="assets/img/create-bundle.webp" alt="DXN Lingzhi Coffee, Spirulina and Morinzhi" class="hidden lg:block w-[226px] xl:w-[250px] self-stretch object-cover" loading="lazy">
      <img src="assets/img/create-bundle.webp" alt="" class="lg:hidden absolute right-0 top-0 h-full w-[42%] object-cover object-left opacity-95" loading="lazy">
      <div class="relative flex-1 grid lg:grid-cols-[1fr_auto] gap-x-5 items-center p-5 lg:py-6 lg:pl-4 lg:pr-5">
        <div class="max-w-[58%] lg:max-w-none">
          <h2 class="font-extrabold lg:font-bold lg:font-serif text-[20px] lg:text-[21px] xl:text-[23px] leading-tight text-brand-band lg:text-ink">Create Your <br class="lg:hidden">Own Bundle</h2>
          <p class="text-[12.5px] lg:text-[14px] leading-snug text-ink-soft mt-2 lg:max-w-[290px]">Choose from a wide range of DXN products and build a package that fits your needs and budget.</p>
          <a href="#/customize" class="btn btn-green mt-4 lg:mt-5 h-10 lg:h-[52px] px-5 lg:w-full lg:max-w-[280px] text-[13px] lg:text-[15.5px]">
            ${icon('gear', 'w-6 h-6 hidden lg:block', 1.6)}Start Customizing${icon('chevronRight', 'w-5 h-5 btn-arrow', 2)}
          </a>
        </div>
        <ul class="hidden lg:flex flex-col gap-3 text-ink-soft">
          ${['Any amount is allowed', 'Pick your favorite products', 'Great for personal use or gifting', 'Same authentic DXN products'].map((t) => checkItem(t, { cls: 'text-[12px] whitespace-nowrap' })).join('')}
        </ul>
      </div>
    </article>

    <!-- Mystery box -->
    <article class="relative overflow-hidden rounded-[16px] bg-gold-soft shadow-[var(--shadow-1)] lg:min-h-[214px] flex flex-col lg:flex-row">
      <img src="assets/img/mystery-box.webp" alt="DXN Mystery Box" class="order-2 lg:order-1 w-full lg:w-[250px] xl:w-[290px] h-[190px] lg:h-auto lg:self-stretch object-cover object-center" loading="lazy">
      <div class="order-1 lg:order-2 flex-1 p-5 lg:py-5 lg:pl-3 lg:pr-6">
        <h2 class="font-extrabold lg:font-bold lg:font-serif text-[20px] lg:text-[21px] text-[#6B4423]">Mystery Box</h2>
        <p class="text-[13px] lg:text-[14px] leading-snug text-gold-deep mt-1 max-w-[260px] lg:max-w-none">Let us surprise you with a curated selection of DXN bestsellers and new products!</p>
        <ul class="hidden lg:flex flex-col gap-1.5 mt-3 text-ink-soft">
          ${['A mix of bestsellers', 'Discover new products', 'Exciting unboxing experience'].map((t) => checkItem(t, { gold: true, cls: 'text-[12.5px]' })).join('')}
        </ul>
        <a href="#/mystery-box" class="hidden lg:flex btn btn-gold mt-3 h-[44px] w-full text-[14.5px]">
          ${icon('box', 'w-6 h-6', 1.5)}Get Mystery Box${icon('chevronRight', 'w-5 h-5 btn-arrow', 2)}
        </a>
      </div>
      <div class="order-3 lg:hidden px-5 pb-5 -mt-2">
        <a href="#/mystery-box" class="btn btn-gold h-11 w-full text-[13.5px]">Get Mystery Box${icon('arrowRight', 'w-4 h-4 btn-arrow')}</a>
      </div>
    </article>
  </section>`;

const shopByCategory = () => `
  <section class="order-3 mx-auto w-full max-w-[1480px] px-4 lg:px-10 pt-8 lg:pt-7 pb-4 lg:pb-0 bg-white lg:bg-transparent">
    <div class="flex items-center justify-between mb-4 lg:mb-3.5">
      <h2 class="font-extrabold lg:font-bold lg:font-serif text-[19px] lg:text-[20px]">Shop by Category</h2>
      ${arrowLink('#/products', '<span class="hidden lg:inline">View All Products</span><span class="lg:hidden text-ink-soft">View All</span>', 'text-[12px] lg:text-[13px]')}
    </div>
    <div class="hidden lg:grid grid-cols-5 gap-4">${categories.map((c) => categoryCard(c, 'row')).join('')}</div>
    <div class="grid lg:hidden grid-cols-2 gap-3">${categories.slice(0, 4).map((c) => categoryCard(c, 'tile')).join('')}</div>
  </section>`;

const featured = () => {
  const list = products.filter((p) => p.featured);
  return `
  <section class="order-5 lg:order-4 mx-auto w-full max-w-[1480px] px-4 lg:px-10 pt-8 lg:pt-8">
    <div class="flex items-center gap-6 mb-4">
      <h2 class="font-extrabold lg:font-bold lg:font-serif text-[17px] lg:text-[20px] shrink-0">Featured DXN Products</h2>
      <div class="hidden lg:flex gap-2.5">${chips('all', { only: MOCKUP_CHIPS })}</div>
      <span class="ml-auto lg:hidden">${arrowLink('#/products', 'View All', 'text-[12px] text-ink-soft')}</span>
    </div>
    <div class="lg:hidden flex gap-2 scroll-x -mx-4 px-4 mb-4">${chips('all', { only: MOCKUP_CHIPS })}</div>

    <div class="hidden lg:block relative">
      <div class="grid grid-cols-5 gap-4" data-featured-row>${list.slice(0, 5).map(productCardRow).join('')}</div>
      <button type="button" class="icon-btn absolute -right-5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white shadow-[var(--shadow-2)]" aria-label="More products" onclick="location.hash='#/products'">${icon('chevronRight', 'w-5 h-5', 2)}</button>
    </div>
    <div class="grid lg:hidden grid-cols-2 gap-3">${list.map(productCardTile).join('')}</div>
  </section>`;
};

const benefits = () => `
  <section class="order-6 hidden lg:block mt-10 bg-white border-y border-line">
    <div class="mx-auto max-w-[1480px] px-10 py-6 grid grid-cols-4 divide-x divide-line">
      ${[['truck', 'Fast & Secure Processing', 'We prepare your package with care.'],
         ['shield', '100% Authentic DXN Products', 'Direct from trusted source.'],
         ['people', 'Supports Your Business Growth', 'Quality products. Real opportunities.'],
         ['headset', "We're Here to Help", 'Contact our support team anytime.']]
        .map(([ic, t, d]) => `<div class="flex items-center gap-4 px-8 first:pl-0">${icon(ic, 'w-11 h-11 shrink-0 text-ink', 1.4)}<div><p class="text-[14.5px] font-semibold">${t}</p><p class="text-[13px] text-ink-mute">${d}</p></div></div>`).join('')}
    </div>
  </section>`;

const band = () => `
  <section class="order-7 hidden lg:block relative overflow-hidden bg-brand-band">
    ${icon('leaf', 'leaf-deco w-40 h-40 -left-8 -bottom-10', 1)}
    ${icon('leaf', 'leaf-deco w-36 h-36 -right-6 -bottom-8 -scale-x-100', 1)}
    <div class="relative mx-auto max-w-[1480px] px-10 h-[80px] flex items-center justify-center">
      <p class="font-script text-white text-[32px] flex items-center gap-6">Healthier People ${icon('leaf', 'w-8 h-8 text-[#7FB069]', 1.6)} Happier Lives</p>
      <a href="#/customize" class="btn btn-cream absolute right-10 h-[46px] px-8 rounded-full text-[15px]">Start Your DXN Journey Today${icon('chevronRight', 'w-4 h-4 btn-arrow', 2.2)}</a>
    </div>
  </section>`;

// ---------- Mobile-only closing sections (mobile sample view, column 2–3) ----------
const sameGreat = () => `
  <section class="order-6 lg:hidden px-3 pt-8">
    <div class="rounded-[16px] bg-gold-soft/70 px-5 py-7 text-center">
      <h2 class="font-extrabold text-[18px] leading-snug text-brand-band">Same Great Products<br>You Choose the Experience</h2>
      <div class="grid grid-cols-2 mt-6 divide-x divide-gold/25">
        <a href="#/customize" class="flex flex-col items-center gap-1.5 px-2 active:opacity-60">${icon('sliders', 'w-10 h-10 text-brand', 1.4)}<span class="font-bold text-[14px] text-brand-band leading-tight mt-1">Customize<br>Your Bundle</span><span class="text-[12px] text-ink-mute">Pick the products you want.</span></a>
        <a href="#/mystery-box" class="flex flex-col items-center gap-1.5 px-2 active:opacity-60">${icon('box', 'w-10 h-10 text-brand', 1.4)}<span class="font-bold text-[14px] text-brand-band leading-tight mt-1">Mystery Box</span><span class="text-[12px] text-ink-mute">A curated mix of DXN products.</span></a>
      </div>
    </div>
  </section>`;

const naturalProducts = () => `
  <section class="order-7 lg:hidden px-3 pt-8">
    <div class="card overflow-hidden">
      <div class="relative h-[168px] bg-cover bg-right" style="background-image:url('assets/img/m-natural.webp')">
        <div class="absolute inset-0 bg-gradient-to-r from-black/45 to-transparent"></div>
        <div class="relative p-5 text-white">
          <h2 class="font-extrabold text-[21px] leading-tight">Natural Products<br>Real Benefits</h2>
          <p class="text-[12.5px] leading-snug mt-2 max-w-[180px]">Support a healthier lifestyle with DXN's high-quality products.</p>
        </div>
      </div>
      <ul class="flex flex-col gap-3 p-5 text-ink-soft">${['Support your wellness', 'Made from natural ingredients', 'Trusted by millions worldwide'].map((t) => checkItem(t, { cls: 'text-[13.5px]' })).join('')}</ul>
    </div>
  </section>`;

const reviews = () => `
  <section class="order-8 lg:hidden px-3 pt-8">
    <h2 class="font-extrabold text-[19px] mb-4 px-1">What Our Customers Say</h2>
    <div class="flex flex-col gap-3">
      ${testimonials.map((t) => `
        <figure class="card p-4 flex gap-4">
          <img src="${t.avatar}" alt="" class="w-14 h-14 rounded-full object-cover shrink-0">
          <div>
            <figcaption class="font-bold text-[14px]">${esc(t.name)}</figcaption>
            <div class="flex text-[#F2B233] my-1" aria-label="${t.rating} out of 5 stars">${icon('star', 'w-4 h-4').repeat(t.rating)}</div>
            <blockquote class="text-[13px] text-ink-soft leading-snug">${esc(t.quote)}</blockquote>
          </div>
        </figure>`).join('')}
    </div>
  </section>`;

const oneWorld = () => `
  <section class="order-9 lg:hidden pt-8">
    <div class="relative overflow-hidden bg-cover bg-center px-5 py-10" style="background-image:url('assets/img/m-one-world.webp')">
      <div class="absolute inset-0 bg-gradient-to-b from-white/10 via-white/0 to-[#0E3219]/30"></div>
      <div class="relative">
        <h2 class="font-extrabold text-[28px] leading-[1.12] text-brand-band">One World<br>One Market<br>One Family</h2>
        <p class="text-[13.5px] text-ink leading-snug mt-4 max-w-[260px]">Be part of a global community that believes in better health and brighter opportunities.</p>
        <a href="#about" class="btn btn-green mt-5 h-11 px-5 text-[13.5px]">Learn More About DXN${icon('arrowRight', 'w-4 h-4 btn-arrow')}</a>
      </div>
    </div>
  </section>`;

const readyCta = () => `
  <section class="order-10 lg:hidden px-4 pt-10 pb-8">
    <h2 class="font-extrabold text-[21px] leading-tight">Ready to Start Your<br>DXN Journey?</h2>
    <p class="text-[13.5px] text-ink-mute leading-snug mt-3">Whether you customize or choose a mystery box, you're one step closer to a healthier and brighter tomorrow.</p>
    <div class="relative mt-4 rounded-[16px] bg-sand overflow-hidden">
      <img src="assets/img/m-cta-package.webp" alt="DXN bundle package" class="w-full h-[170px] object-cover" loading="lazy">
      <div class="px-3 pb-3 -mt-6 relative">
        <a href="#/customize" class="btn btn-green w-full h-12 text-[14px]">Get Your DXN Package Now${icon('arrowRight', 'w-4 h-4 btn-arrow')}</a>
      </div>
    </div>
  </section>`;

export function renderHome() {
  return `<div class="flex flex-col">
    ${hero()}${whyChoose()}${shopByCategory()}${promos()}${featured()}${benefits()}${band()}
    ${sameGreat()}${naturalProducts()}${reviews()}${oneWorld()}${readyCta()}
  </div>`;
}
