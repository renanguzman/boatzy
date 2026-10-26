import { redirect } from 'next/navigation';

// O cadastro do gestor passou para a landing `/painel/login` (aba "Criar conta").
// A rota continua existindo para links antigos e e-mails já enviados.
export default function PainelCadastroPage() {
  redirect('/painel/login?aba=cadastro');
}
