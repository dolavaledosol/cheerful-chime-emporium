import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const PoliticaPrivacidade = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-sidebar text-sidebar-foreground">
        <div className="container mx-auto px-4 flex h-16 items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <img src="/images/logo-cozinha-dodola-branco.png" alt="CozinhaDoDola" className="h-10 w-auto" />
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="text-3xl font-bold mb-8">Política de Privacidade</h1>

        <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">
          <p className="text-foreground font-medium">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">1. Informações que coletamos</h2>
            <p>Ao utilizar nosso site e serviços, podemos coletar as seguintes informações pessoais:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Nome completo</li>
              <li>Endereço de e-mail</li>
              <li>CPF ou CNPJ</li>
              <li>Número de telefone</li>
              <li>Endereço de entrega (CEP, logradouro, número, bairro, cidade, estado)</li>
              <li>Dados de navegação e preferências de compra</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. Como utilizamos suas informações</h2>
            <p>As informações coletadas são utilizadas para:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Processar e entregar seus pedidos</li>
              <li>Gerenciar sua conta e fornecer suporte ao cliente</li>
              <li>Enviar notificações sobre o status dos pedidos</li>
              <li>Melhorar nossos produtos e serviços</li>
              <li>Cumprir obrigações legais e fiscais</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">3. Compartilhamento de dados</h2>
            <p>Não vendemos, alugamos ou compartilhamos suas informações pessoais com terceiros, exceto quando necessário para:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Processar pagamentos através de plataformas seguras</li>
              <li>Realizar entregas por transportadoras parceiras</li>
              <li>Cumprir exigências legais ou ordens judiciais</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">4. Segurança dos dados</h2>
            <p>Adotamos medidas técnicas e organizacionais para proteger suas informações pessoais contra acesso não autorizado, perda, destruição ou alteração. Utilizamos criptografia e servidores seguros para armazenar seus dados.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">5. Cookies</h2>
            <p>Utilizamos cookies e tecnologias similares para melhorar sua experiência de navegação, lembrar suas preferências e analisar o tráfego do site. Você pode gerenciar suas preferências de cookies nas configurações do seu navegador.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">6. Seus direitos (LGPD)</h2>
            <p>Em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018), você tem os seguintes direitos:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Confirmar a existência de tratamento de seus dados</li>
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir dados incompletos ou desatualizados</li>
              <li>Solicitar a eliminação de dados desnecessários</li>
              <li>Revogar seu consentimento a qualquer momento</li>
              <li>Solicitar a portabilidade dos dados</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">7. Retenção de dados</h2>
            <p>Mantemos seus dados pessoais pelo tempo necessário para cumprir as finalidades para as quais foram coletados, incluindo obrigações legais, fiscais e regulatórias.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">8. Contato</h2>
            <p>Para exercer seus direitos ou esclarecer dúvidas sobre esta política, entre em contato conosco através dos canais disponíveis em nosso site.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">9. Alterações nesta política</h2>
            <p>Reservamo-nos o direito de atualizar esta Política de Privacidade a qualquer momento. Recomendamos que você revise periodicamente esta página para se manter informado sobre eventuais mudanças.</p>
          </section>
        </div>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} CozinhaDoDola — Todos os direitos reservados
      </footer>
    </div>
  );
};

export default PoliticaPrivacidade;
