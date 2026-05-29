# DESIGN.md — SETPOLITIC

## Brand
**Nome:** SETPOLITIC  
**Tagline:** Sistema Eleitoral Goiano  
**Vibe:** Autoridade política + confiança institucional + modernidade técnica  
**Mood:** Profissional, sólido, verde floresta, ouro eleitoral

---

## Colors

### Brand Tokens
| Token | Hex | Uso |
|-------|-----|-----|
| `brand-dark` | `#1a3d1f` | "SET" no logo, sidebar background |
| `brand-green` | `#2e7d22` | Primary — botões, links, active states |
| `brand-bright` | `#4aab1e` | "POLITIC" no logo, hover accent |
| `brand-gold` | `#f5c53a` | Checkmark, CTA destaque, warning |

### CSS Variables (Tailwind HSL)
```css
--primary: 108 58% 33%        /* #2e7d22 — verde brand */
--sidebar-background: 127 42% 9%  /* #0d2818 — verde escuro */
--sidebar-primary: 108 60% 52%    /* verde vibrante no dark */
--warning: 44 90% 52%             /* #f5c53a — ouro */
--success: 142 71% 45%            /* verde confirmação */
```

---

## Typography

- **Headings:** Inter, weight 700-800, tracking -0.025em  
- **Body:** Inter, weight 400, line-height 1.6  
- **Numbers/Mono:** JetBrains Mono, tabular-nums  
- **Brand mark:** SET (bold 800, foreground) + POLITIC (bold 800, primary)

---

## Spacing
Base: 4px. Scale: 4, 8, 12, 16, 24, 32, 48, 64

---

## Components

### Buttons
- Height: 36-40px
- Padding: 16px horizontal
- Border radius: 6px (buttons), 8px (cards), 4px (inputs)
- Primary: `bg-primary text-white hover:bg-primary/90`
- Gold CTA: `bg-warning text-black hover:bg-warning/90`

### Cards
- Border: `border-border/50`
- Shadow: `shadow-sm`
- Hover: `hover:border-primary/30 hover:shadow-md`

### Badges de partido
- Background: `partidoCor + '20'`
- Text: `partidoCor`
- Font: bold, 9-10px

### KPICard
- Icon container: `bg-primary/10` com `text-primary`
- Value: `text-xl font-bold`
- Label: `text-[10px] uppercase text-muted-foreground`

---

## Sidebar
- Background: `#0d2818` (verde floresta escuro)
- Active item: fundo `sidebar-primary/15` + dot verde
- Brand mark: "SET" branco + "POLITIC" verde vibrante
- Tagline: "Sistema Eleitoral Goiano" em caps pequeno

---

## SaaS Specifics

### Plano único anual
- Preço: **R$ 99/ano**
- CTA: botão ouro `#f5c53a` com texto escuro
- Badge: "Acesso completo a todos os dados"

### Auth pages (/login, /signup)
- Layout: split — esquerda brand verde escuro, direita form branco
- Logo grande no painel esquerdo
- Form shadcn/ui, inputs limpos

### Admin panel
- Tabela de clientes com status badge colorido
- `active` → verde, `trialing` → ouro, `canceled` → vermelho, `past_due` → laranja
