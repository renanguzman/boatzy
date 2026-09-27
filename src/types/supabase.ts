import type { ConfirmacaoTipo, DispositivoTipo, GeoGpsStatus } from '@/lib/termos/tipos';

export type UserRole = 'admin' | 'gestor' | 'cliente';
export type EmbarcacaoStatus = 'ativo' | 'inativo' | 'em_manutencao';
export type PrecoRegraTipo = 'dia_semana' | 'periodo_anual' | 'data_fixa';
export type ModalidadeCapitao = 'sem_capitao' | 'com_capitao' | 'opcional';
export type CatalogoTipo = 'produto' | 'servico';
export type ReservaStatus = 'pendente' | 'confirmada' | 'recusada' | 'cancelada' | 'concluida';
export type ReservaTipo = 'roteiro' | 'embarcacao';
/** Modelo de cobrança usado na solicitação: Roteiro (diária única), Por Diária ou Por Pessoa. */
export type ReservaModalidadePreco = 'roteiro' | 'diaria' | 'pessoa';
/** Como a capacidade do modelo Por Pessoa é controlada — ver `roteiro.preco_pessoa_modo_capacidade`. */
export type PrecoPessoaModoCapacidade = 'compartilhado' | 'exclusivo';
export type AvaliacaoStatus = 'pendente' | 'aprovada';
export type AnuncioVendaStatus = 'ativo' | 'pausado' | 'vendido' | 'cancelado';
export type AnuncioInteracaoTipo =
  | 'visualizou'
  | 'revelou_contato'
  | 'favoritou'
  | 'compartilhou'
  | 'conversou';
export type CupomTipoDesconto = 'percentual' | 'valor_fixo';
export type TermoUsoStatus = 'rascunho' | 'publicado' | 'arquivado';

export type Database = {
  public: {
    Tables: {
      reserva: {
        Row: {
          id: string;
          tipo: ReservaTipo;
          roteiro_id: string | null;
          embarcacao_id: string | null;
          cliente_id: string;
          owner_id: string;
          data_reserva: string;
          flexibilidade: number | null;
          quantidade_pessoas: number;
          item_nome: string;
          preco_base: number | null;
          modalidade_preco: ReservaModalidadePreco;
          quantidade_diarias: number | null;
          data_fim_reserva: string | null;
          total_adicionais: number;
          taxa_servico: number | null;
          taxa_percent: number | null;
          total_estimado: number | null;
          status: ReservaStatus;
          observacao_gestor: string | null;
          solicitado_em: string;
          respondido_em: string | null;
          cancelada_em: string | null;
          cupom_id: string | null;
          cupom_codigo: string | null;
          desconto_valor: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tipo?: ReservaTipo;
          roteiro_id?: string | null;
          embarcacao_id?: string | null;
          cliente_id: string;
          owner_id: string;
          data_reserva: string;
          flexibilidade?: number | null;
          quantidade_pessoas: number;
          item_nome: string;
          preco_base?: number | null;
          modalidade_preco?: ReservaModalidadePreco;
          quantidade_diarias?: number | null;
          data_fim_reserva?: string | null;
          total_adicionais?: number;
          taxa_servico?: number | null;
          taxa_percent?: number | null;
          total_estimado?: number | null;
          status?: ReservaStatus;
          observacao_gestor?: string | null;
          solicitado_em?: string;
          respondido_em?: string | null;
          cancelada_em?: string | null;
          cupom_id?: string | null;
          cupom_codigo?: string | null;
          desconto_valor?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tipo?: ReservaTipo;
          roteiro_id?: string | null;
          embarcacao_id?: string | null;
          cliente_id?: string;
          owner_id?: string;
          data_reserva?: string;
          flexibilidade?: number | null;
          quantidade_pessoas?: number;
          item_nome?: string;
          preco_base?: number | null;
          modalidade_preco?: ReservaModalidadePreco;
          quantidade_diarias?: number | null;
          data_fim_reserva?: string | null;
          total_adicionais?: number;
          taxa_servico?: number | null;
          taxa_percent?: number | null;
          total_estimado?: number | null;
          status?: ReservaStatus;
          observacao_gestor?: string | null;
          solicitado_em?: string;
          respondido_em?: string | null;
          cancelada_em?: string | null;
          cupom_id?: string | null;
          cupom_codigo?: string | null;
          desconto_valor?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reserva_roteiro_id_fkey';
            columns: ['roteiro_id'];
            isOneToOne: false;
            referencedRelation: 'roteiro';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reserva_cliente_id_fkey';
            columns: ['cliente_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reserva_cupom_id_fkey';
            columns: ['cupom_id'];
            isOneToOne: false;
            referencedRelation: 'cupom';
            referencedColumns: ['id'];
          },
        ];
      };
      reserva_adicional: {
        Row: {
          id: string;
          reserva_id: string;
          roteiro_catalogo_id: string | null;
          descricao: string;
          valor: number;
          tipo: CatalogoTipo;
          created_at: string;
        };
        Insert: {
          id?: string;
          reserva_id: string;
          roteiro_catalogo_id?: string | null;
          descricao: string;
          valor: number;
          tipo: CatalogoTipo;
          created_at?: string;
        };
        Update: {
          id?: string;
          reserva_id?: string;
          roteiro_catalogo_id?: string | null;
          descricao?: string;
          valor?: number;
          tipo?: CatalogoTipo;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reserva_adicional_reserva_id_fkey';
            columns: ['reserva_id'];
            isOneToOne: false;
            referencedRelation: 'reserva';
            referencedColumns: ['id'];
          },
        ];
      };
      favorito: {
        Row: {
          id: string;
          user_id: string;
          roteiro_id: string | null;
          embarcacao_id: string | null;
          anuncio_venda_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          roteiro_id?: string | null;
          embarcacao_id?: string | null;
          anuncio_venda_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          roteiro_id?: string | null;
          embarcacao_id?: string | null;
          anuncio_venda_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'favorito_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'favorito_roteiro_id_fkey';
            columns: ['roteiro_id'];
            isOneToOne: false;
            referencedRelation: 'roteiro';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'favorito_embarcacao_id_fkey';
            columns: ['embarcacao_id'];
            isOneToOne: false;
            referencedRelation: 'embarcacao';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'favorito_anuncio_venda_id_fkey';
            columns: ['anuncio_venda_id'];
            isOneToOne: false;
            referencedRelation: 'anuncio_venda';
            referencedColumns: ['id'];
          },
        ];
      };
      avaliacao: {
        Row: {
          id: string;
          reserva_id: string;
          cliente_id: string;
          roteiro_id: string | null;
          embarcacao_id: string | null;
          nota: number;
          comentario: string | null;
          status: AvaliacaoStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          reserva_id: string;
          cliente_id: string;
          roteiro_id?: string | null;
          embarcacao_id?: string | null;
          nota: number;
          comentario?: string | null;
          status?: AvaliacaoStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          reserva_id?: string;
          cliente_id?: string;
          roteiro_id?: string | null;
          embarcacao_id?: string | null;
          nota?: number;
          comentario?: string | null;
          status?: AvaliacaoStatus;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'avaliacao_reserva_id_fkey';
            columns: ['reserva_id'];
            isOneToOne: true;
            referencedRelation: 'reserva';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'avaliacao_cliente_id_fkey';
            columns: ['cliente_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          cpf_cnpj: string | null;
          phone: string | null;
          birthday: string | null;
          avatar_url: string | null;
          endereco_cep: string | null;
          endereco_estado_id: number | null;
          endereco_municipio_id: number | null;
          endereco_bairro: string | null;
          endereco_logradouro: string | null;
          endereco_numero: string | null;
          endereco_complemento: string | null;
          notif_email_conversas: boolean;
          chat_aviso_ciente_em: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          email: string;
          cpf_cnpj?: string | null;
          phone?: string | null;
          birthday?: string | null;
          avatar_url?: string | null;
          endereco_cep?: string | null;
          endereco_estado_id?: number | null;
          endereco_municipio_id?: number | null;
          endereco_bairro?: string | null;
          endereco_logradouro?: string | null;
          endereco_numero?: string | null;
          endereco_complemento?: string | null;
          notif_email_conversas?: boolean;
          chat_aviso_ciente_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          cpf_cnpj?: string | null;
          phone?: string | null;
          birthday?: string | null;
          avatar_url?: string | null;
          endereco_cep?: string | null;
          endereco_estado_id?: number | null;
          endereco_municipio_id?: number | null;
          endereco_bairro?: string | null;
          endereco_logradouro?: string | null;
          endereco_numero?: string | null;
          endereco_complemento?: string | null;
          notif_email_conversas?: boolean;
          chat_aviso_ciente_em?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: UserRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: UserRole;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_roles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      taxa_plataforma: {
        Row: {
          id: string;
          taxa_percent: number;
          descricao: string | null;
          singleton: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          taxa_percent: number;
          descricao?: string | null;
          singleton?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          taxa_percent?: number;
          descricao?: string | null;
          singleton?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      usuario_taxa: {
        Row: {
          id: string;
          user_id: string;
          taxa_percent: number;
          ativo: boolean;
          data_validade: string | null;
          observacao: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          taxa_percent: number;
          ativo?: boolean;
          data_validade?: string | null;
          observacao?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          taxa_percent?: number;
          ativo?: boolean;
          data_validade?: string | null;
          observacao?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'usuario_taxa_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      estados: {
        Row: {
          id: number;
          uf: string;
          nome: string;
          latitude: number | null;
          longitude: number | null;
          regiao: string | null;
        };
        Insert: {
          id: number;
          uf: string;
          nome: string;
          latitude?: number | null;
          longitude?: number | null;
          regiao?: string | null;
        };
        Update: {
          id?: number;
          uf?: string;
          nome?: string;
          latitude?: number | null;
          longitude?: number | null;
          regiao?: string | null;
        };
        Relationships: [];
      };
      municipios: {
        Row: {
          id: number;
          nome: string;
          latitude: number | null;
          longitude: number | null;
          capital: boolean;
          estado_id: number;
          siafi_id: number | null;
          ddd: number | null;
          fuso_horario: string | null;
        };
        Insert: {
          id: number;
          nome: string;
          latitude?: number | null;
          longitude?: number | null;
          capital?: boolean;
          estado_id: number;
          siafi_id?: number | null;
          ddd?: number | null;
          fuso_horario?: string | null;
        };
        Update: {
          id?: number;
          nome?: string;
          latitude?: number | null;
          longitude?: number | null;
          capital?: boolean;
          estado_id?: number;
          siafi_id?: number | null;
          ddd?: number | null;
          fuso_horario?: string | null;
        };
        Relationships: [];
      };
      embarcacao_tipo: {
        Row: { id: string; nome: string };
        Insert: { id?: string; nome: string };
        Update: { id?: string; nome?: string };
        Relationships: [];
      };
      embarcacao: {
        Row: {
          id: string;
          owner_id: string;
          nome: string;
          descricao: string | null;
          capacidade: number | null;
          comprimento: number | null;
          comprimento_unidade: 'm' | 'pes';
          quartos: number | null;
          suites: number | null;
          banheiros: number | null;
          tripulacao: number | null;
          embarcacao_tipo_id: string | null;
          municipio_id: number | null;
          cep: string | null;
          bairro: string | null;
          logradouro: string | null;
          logradouro_numero: string | null;
          complemento: string | null;
          latitude: number | null;
          longitude: number | null;
          status: EmbarcacaoStatus;
          modalidade_capitao: ModalidadeCapitao;
          preco_base: number | null;
          disponibilidade_dias_semana: number[] | null;
          created_at: string;
          updated_at: string;
          data_criacao: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          nome: string;
          descricao?: string | null;
          capacidade?: number | null;
          comprimento?: number | null;
          comprimento_unidade?: 'm' | 'pes';
          quartos?: number | null;
          suites?: number | null;
          banheiros?: number | null;
          tripulacao?: number | null;
          embarcacao_tipo_id?: string | null;
          municipio_id?: number | null;
          cep?: string | null;
          bairro?: string | null;
          logradouro?: string | null;
          logradouro_numero?: string | null;
          complemento?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          status?: EmbarcacaoStatus;
          modalidade_capitao?: ModalidadeCapitao;
          preco_base?: number | null;
          disponibilidade_dias_semana?: number[] | null;
          created_at?: string;
          updated_at?: string;
          data_criacao?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          nome?: string;
          descricao?: string | null;
          capacidade?: number | null;
          comprimento?: number | null;
          comprimento_unidade?: 'm' | 'pes';
          quartos?: number | null;
          suites?: number | null;
          banheiros?: number | null;
          tripulacao?: number | null;
          embarcacao_tipo_id?: string | null;
          municipio_id?: number | null;
          cep?: string | null;
          bairro?: string | null;
          logradouro?: string | null;
          logradouro_numero?: string | null;
          complemento?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          status?: EmbarcacaoStatus;
          modalidade_capitao?: ModalidadeCapitao;
          preco_base?: number | null;
          disponibilidade_dias_semana?: number[] | null;
          updated_at?: string;
          data_criacao?: string;
        };
        Relationships: [];
      };
      embarcacao_disponibilidade_bloqueio: {
        Row: {
          id: string;
          embarcacao_id: string;
          data: string;
          motivo: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          embarcacao_id: string;
          data: string;
          motivo?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          embarcacao_id?: string;
          data?: string;
          motivo?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      embarcacao_preco_regra: {
        Row: {
          id: string;
          embarcacao_id: string;
          nome: string;
          valor: number;
          tipo: PrecoRegraTipo;
          prioridade: number;
          ativo: boolean;
          dias_semana: number[] | null;
          periodo_mes_inicio: number | null;
          periodo_dia_inicio: number | null;
          periodo_mes_fim: number | null;
          periodo_dia_fim: number | null;
          data_inicio: string | null;
          data_fim: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          embarcacao_id: string;
          nome: string;
          valor: number;
          tipo: PrecoRegraTipo;
          prioridade?: number;
          ativo?: boolean;
          dias_semana?: number[] | null;
          periodo_mes_inicio?: number | null;
          periodo_dia_inicio?: number | null;
          periodo_mes_fim?: number | null;
          periodo_dia_fim?: number | null;
          data_inicio?: string | null;
          data_fim?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          embarcacao_id?: string;
          nome?: string;
          valor?: number;
          tipo?: PrecoRegraTipo;
          prioridade?: number;
          ativo?: boolean;
          dias_semana?: number[] | null;
          periodo_mes_inicio?: number | null;
          periodo_dia_inicio?: number | null;
          periodo_mes_fim?: number | null;
          periodo_dia_fim?: number | null;
          data_inicio?: string | null;
          data_fim?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      embarcacao_imagens: {
        Row: {
          id: string;
          embarcacao_id: string;
          url_imagem: string;
          titulo: string | null;
          principal: boolean;
          ordem: number;
          data_criacao: string;
        };
        Insert: {
          id?: string;
          embarcacao_id: string;
          url_imagem: string;
          titulo?: string | null;
          principal?: boolean;
          ordem?: number;
          data_criacao?: string;
        };
        Update: {
          id?: string;
          embarcacao_id?: string;
          url_imagem?: string;
          titulo?: string | null;
          principal?: boolean;
          ordem?: number;
          data_criacao?: string;
        };
        Relationships: [];
      };
      comodidade: {
        Row: { id: string; nome: string };
        Insert: { id?: string; nome: string };
        Update: { id?: string; nome?: string };
        Relationships: [];
      };
      embarcacao_comodidades: {
        Row: { id: string; embarcacao_id: string; comodidade_id: string };
        Insert: { id?: string; embarcacao_id: string; comodidade_id: string };
        Update: { id?: string; embarcacao_id?: string; comodidade_id?: string };
        Relationships: [];
      };
      roteiro: {
        Row: {
          id: string;
          owner_id: string;
          embarcacao_id: string | null;
          nome: string;
          descricao: string;
          duracao: string | null;
          duracao_horas: number | null;
          quantidade_pessoas: number | null;
          origem: string | null;
          destino: string | null;
          municipio_id: number | null;
          cep: string | null;
          bairro: string | null;
          logradouro: string | null;
          logradouro_numero: string | null;
          complemento: string | null;
          latitude: number | null;
          longitude: number | null;
          preco_base: number | null;
          preco_diaria_ativo: boolean;
          preco_diaria_valor: number | null;
          preco_diaria_minimo: number;
          preco_pessoa_ativo: boolean;
          preco_pessoa_valor: number | null;
          preco_pessoa_capacidade_minima: number | null;
          preco_pessoa_capacidade_maxima: number | null;
          preco_pessoa_modo_capacidade: PrecoPessoaModoCapacidade;
          disponibilidade_dias_semana: number[] | null;
          ativo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          embarcacao_id?: string | null;
          nome: string;
          descricao: string;
          duracao?: string | null;
          duracao_horas?: number | null;
          quantidade_pessoas?: number | null;
          origem?: string | null;
          destino?: string | null;
          municipio_id?: number | null;
          cep?: string | null;
          bairro?: string | null;
          logradouro?: string | null;
          logradouro_numero?: string | null;
          complemento?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          preco_base?: number | null;
          preco_diaria_ativo?: boolean;
          preco_diaria_valor?: number | null;
          preco_diaria_minimo?: number;
          preco_pessoa_ativo?: boolean;
          preco_pessoa_valor?: number | null;
          preco_pessoa_capacidade_minima?: number | null;
          preco_pessoa_capacidade_maxima?: number | null;
          preco_pessoa_modo_capacidade?: PrecoPessoaModoCapacidade;
          disponibilidade_dias_semana?: number[] | null;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          embarcacao_id?: string | null;
          nome?: string;
          descricao?: string;
          duracao?: string | null;
          duracao_horas?: number | null;
          quantidade_pessoas?: number | null;
          origem?: string | null;
          destino?: string | null;
          municipio_id?: number | null;
          cep?: string | null;
          bairro?: string | null;
          logradouro?: string | null;
          logradouro_numero?: string | null;
          complemento?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          preco_base?: number | null;
          preco_diaria_ativo?: boolean;
          preco_diaria_valor?: number | null;
          preco_diaria_minimo?: number;
          preco_pessoa_ativo?: boolean;
          preco_pessoa_valor?: number | null;
          preco_pessoa_capacidade_minima?: number | null;
          preco_pessoa_capacidade_maxima?: number | null;
          preco_pessoa_modo_capacidade?: PrecoPessoaModoCapacidade;
          disponibilidade_dias_semana?: number[] | null;
          ativo?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      roteiro_disponibilidade_bloqueio: {
        Row: {
          id: string;
          roteiro_id: string;
          data: string;
          motivo: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          roteiro_id: string;
          data: string;
          motivo?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          roteiro_id?: string;
          data?: string;
          motivo?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      roteiro_parada: {
        Row: {
          id: string;
          roteiro_id: string;
          ordem: number;
          nome: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          roteiro_id: string;
          ordem: number;
          nome: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          roteiro_id?: string;
          ordem?: number;
          nome?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      roteiro_preco_regra: {
        Row: {
          id: string;
          roteiro_id: string;
          nome: string;
          valor: number;
          tipo: PrecoRegraTipo;
          prioridade: number;
          ativo: boolean;
          dias_semana: number[] | null;
          periodo_mes_inicio: number | null;
          periodo_dia_inicio: number | null;
          periodo_mes_fim: number | null;
          periodo_dia_fim: number | null;
          data_inicio: string | null;
          data_fim: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          roteiro_id: string;
          nome: string;
          valor: number;
          tipo: PrecoRegraTipo;
          prioridade?: number;
          ativo?: boolean;
          dias_semana?: number[] | null;
          periodo_mes_inicio?: number | null;
          periodo_dia_inicio?: number | null;
          periodo_mes_fim?: number | null;
          periodo_dia_fim?: number | null;
          data_inicio?: string | null;
          data_fim?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          roteiro_id?: string;
          nome?: string;
          valor?: number;
          tipo?: PrecoRegraTipo;
          prioridade?: number;
          ativo?: boolean;
          dias_semana?: number[] | null;
          periodo_mes_inicio?: number | null;
          periodo_dia_inicio?: number | null;
          periodo_mes_fim?: number | null;
          periodo_dia_fim?: number | null;
          data_inicio?: string | null;
          data_fim?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      roteiro_imagens: {
        Row: {
          id: string;
          roteiro_id: string;
          url_imagem: string;
          titulo: string | null;
          principal: boolean;
          ordem: number;
          data_criacao: string;
        };
        Insert: {
          id?: string;
          roteiro_id: string;
          url_imagem: string;
          titulo?: string | null;
          principal?: boolean;
          ordem?: number;
          data_criacao?: string;
        };
        Update: {
          id?: string;
          roteiro_id?: string;
          url_imagem?: string;
          titulo?: string | null;
          principal?: boolean;
          ordem?: number;
          data_criacao?: string;
        };
        Relationships: [];
      };
      catalogo: {
        Row: {
          id: string;
          descricao: string;
          valor: number;
          tipo: CatalogoTipo;
          owner_id: string;
          is_boatzy: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          descricao: string;
          valor: number;
          tipo: CatalogoTipo;
          owner_id: string;
          is_boatzy?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          descricao?: string;
          valor?: number;
          tipo?: CatalogoTipo;
          owner_id?: string;
          is_boatzy?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'catalogo_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      roteiro_catalogo: {
        Row: {
          id: string;
          roteiro_id: string;
          catalogo_id: string;
          valor_customizado: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          roteiro_id: string;
          catalogo_id: string;
          valor_customizado?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          roteiro_id?: string;
          catalogo_id?: string;
          valor_customizado?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'roteiro_catalogo_roteiro_id_fkey';
            columns: ['roteiro_id'];
            isOneToOne: false;
            referencedRelation: 'roteiro';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'roteiro_catalogo_catalogo_id_fkey';
            columns: ['catalogo_id'];
            isOneToOne: false;
            referencedRelation: 'catalogo';
            referencedColumns: ['id'];
          },
        ];
      };
      conversa: {
        Row: {
          id: string;
          gestor_id: string;
          cliente_id: string;
          origem_tipo: string | null;
          origem_id: string | null;
          origem_label: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          gestor_id: string;
          cliente_id: string;
          origem_tipo?: string | null;
          origem_id?: string | null;
          origem_label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          gestor_id?: string;
          cliente_id?: string;
          origem_tipo?: string | null;
          origem_id?: string | null;
          origem_label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversa_gestor_id_fkey';
            columns: ['gestor_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversa_cliente_id_fkey';
            columns: ['cliente_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      mensagem: {
        Row: {
          id: string;
          conversa_id: string;
          remetente_id: string;
          conteudo: string;
          lida_em: string | null;
          notificada_em: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversa_id: string;
          remetente_id: string;
          conteudo: string;
          lida_em?: string | null;
          notificada_em?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversa_id?: string;
          remetente_id?: string;
          conteudo?: string;
          lida_em?: string | null;
          notificada_em?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mensagem_conversa_id_fkey';
            columns: ['conversa_id'];
            isOneToOne: false;
            referencedRelation: 'conversa';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mensagem_remetente_id_fkey';
            columns: ['remetente_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      anuncio_venda: {
        Row: {
          id: string;
          embarcacao_id: string;
          owner_id: string;
          fabricante: string;
          ano_modelo: number;
          ano_fabricacao: number;
          preco: number;
          descricao_venda: string | null;
          status: AnuncioVendaStatus;
          visualizacoes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          embarcacao_id: string;
          owner_id: string;
          fabricante: string;
          ano_modelo: number;
          ano_fabricacao: number;
          preco: number;
          descricao_venda?: string | null;
          status?: AnuncioVendaStatus;
          visualizacoes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          embarcacao_id?: string;
          owner_id?: string;
          fabricante?: string;
          ano_modelo?: number;
          ano_fabricacao?: number;
          preco?: number;
          descricao_venda?: string | null;
          status?: AnuncioVendaStatus;
          visualizacoes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'anuncio_venda_embarcacao_id_fkey';
            columns: ['embarcacao_id'];
            isOneToOne: false;
            referencedRelation: 'embarcacao';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'anuncio_venda_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      anuncio_venda_preco: {
        Row: {
          id: string;
          anuncio_id: string;
          preco: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          anuncio_id: string;
          preco: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          anuncio_id?: string;
          preco?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'anuncio_venda_preco_anuncio_id_fkey';
            columns: ['anuncio_id'];
            isOneToOne: false;
            referencedRelation: 'anuncio_venda';
            referencedColumns: ['id'];
          },
        ];
      };
      anuncio_venda_interacao: {
        Row: {
          id: string;
          anuncio_id: string;
          user_id: string;
          tipo: AnuncioInteracaoTipo;
          created_at: string;
        };
        Insert: {
          id?: string;
          anuncio_id: string;
          user_id: string;
          tipo: AnuncioInteracaoTipo;
          created_at?: string;
        };
        Update: {
          id?: string;
          anuncio_id?: string;
          user_id?: string;
          tipo?: AnuncioInteracaoTipo;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'anuncio_venda_interacao_anuncio_id_fkey';
            columns: ['anuncio_id'];
            isOneToOne: false;
            referencedRelation: 'anuncio_venda';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'anuncio_venda_interacao_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      parceiro: {
        Row: {
          id: string;
          nome: string;
          ativo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cupom: {
        Row: {
          id: string;
          codigo: string;
          descricao: string | null;
          tipo_desconto: CupomTipoDesconto;
          valor: number;
          valor_desconto_maximo: number | null;
          valor_minimo_pedido: number | null;
          data_inicio: string | null;
          data_fim: string | null;
          limite_uso_total: number | null;
          limite_uso_por_cliente: number | null;
          ativo: boolean;
          parceiro_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          codigo: string;
          descricao?: string | null;
          tipo_desconto: CupomTipoDesconto;
          valor: number;
          valor_desconto_maximo?: number | null;
          valor_minimo_pedido?: number | null;
          data_inicio?: string | null;
          data_fim?: string | null;
          limite_uso_total?: number | null;
          limite_uso_por_cliente?: number | null;
          ativo?: boolean;
          parceiro_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          codigo?: string;
          descricao?: string | null;
          tipo_desconto?: CupomTipoDesconto;
          valor?: number;
          valor_desconto_maximo?: number | null;
          valor_minimo_pedido?: number | null;
          data_inicio?: string | null;
          data_fim?: string | null;
          limite_uso_total?: number | null;
          limite_uso_por_cliente?: number | null;
          ativo?: boolean;
          parceiro_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cupom_parceiro_id_fkey';
            columns: ['parceiro_id'];
            isOneToOne: false;
            referencedRelation: 'parceiro';
            referencedColumns: ['id'];
          },
        ];
      };
      cupom_uso: {
        Row: {
          id: string;
          cupom_id: string;
          reserva_id: string | null;
          cliente_id: string | null;
          valor_desconto: number;
          criado_em: string;
        };
        Insert: {
          id?: string;
          cupom_id: string;
          reserva_id?: string | null;
          cliente_id?: string | null;
          valor_desconto: number;
          criado_em?: string;
        };
        Update: {
          id?: string;
          cupom_id?: string;
          reserva_id?: string | null;
          cliente_id?: string | null;
          valor_desconto?: number;
          criado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cupom_uso_cupom_id_fkey';
            columns: ['cupom_id'];
            isOneToOne: false;
            referencedRelation: 'cupom';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cupom_uso_reserva_id_fkey';
            columns: ['reserva_id'];
            isOneToOne: false;
            referencedRelation: 'reserva';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cupom_uso_cliente_id_fkey';
            columns: ['cliente_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      cupom_tentativa: {
        Row: {
          cliente_id: string;
          tentativas: number;
          bloqueado_ate: string | null;
          atualizado_em: string;
        };
        Insert: {
          cliente_id: string;
          tentativas?: number;
          bloqueado_ate?: string | null;
          atualizado_em?: string;
        };
        Update: {
          cliente_id?: string;
          tentativas?: number;
          bloqueado_ate?: string | null;
          atualizado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cupom_tentativa_cliente_id_fkey';
            columns: ['cliente_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      equipe_membro: {
        Row: {
          id: string;
          owner_id: string;
          user_id: string | null;
          is_gestor: boolean;
          nome_completo: string;
          cpf: string | null;
          email: string | null;
          telefone: string | null;
          foto_url: string | null;
          ativo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          user_id?: string | null;
          is_gestor?: boolean;
          nome_completo: string;
          cpf?: string | null;
          email?: string | null;
          telefone?: string | null;
          foto_url?: string | null;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          user_id?: string | null;
          is_gestor?: boolean;
          nome_completo?: string;
          cpf?: string | null;
          email?: string | null;
          telefone?: string | null;
          foto_url?: string | null;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'equipe_membro_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'equipe_membro_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      equipe_membro_embarcacao: {
        Row: {
          id: string;
          equipe_membro_id: string;
          embarcacao_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          equipe_membro_id: string;
          embarcacao_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          equipe_membro_id?: string;
          embarcacao_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'equipe_membro_embarcacao_equipe_membro_id_fkey';
            columns: ['equipe_membro_id'];
            isOneToOne: false;
            referencedRelation: 'equipe_membro';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'equipe_membro_embarcacao_embarcacao_id_fkey';
            columns: ['embarcacao_id'];
            isOneToOne: false;
            referencedRelation: 'embarcacao';
            referencedColumns: ['id'];
          },
        ];
      };
      reserva_atendente: {
        Row: {
          id: string;
          reserva_id: string;
          equipe_membro_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          reserva_id: string;
          equipe_membro_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          reserva_id?: string;
          equipe_membro_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reserva_atendente_reserva_id_fkey';
            columns: ['reserva_id'];
            isOneToOne: false;
            referencedRelation: 'reserva';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reserva_atendente_equipe_membro_id_fkey';
            columns: ['equipe_membro_id'];
            isOneToOne: false;
            referencedRelation: 'equipe_membro';
            referencedColumns: ['id'];
          },
        ];
      };
      termos_uso_plataforma: {
        Row: {
          id: string;
          identificador: string;
          versao: number;
          titulo: string;
          conteudo: string;
          conteudo_hash: string | null;
          descricao_interna: string | null;
          status: TermoUsoStatus;
          exige_rolagem_completa: boolean;
          exige_confirmacao_digitada: boolean;
          criado_por: string | null;
          publicado_por: string | null;
          publicado_em: string | null;
          arquivado_em: string | null;
          data_cadastro: string;
          data_atualizacao: string;
        };
        Insert: {
          id?: string;
          identificador: string;
          versao?: number; // atribuída por trigger
          titulo: string;
          conteudo: string;
          descricao_interna?: string | null;
          status?: 'rascunho'; // sempre nasce rascunho (trigger)
          exige_rolagem_completa?: boolean;
          exige_confirmacao_digitada?: boolean;
          criado_por?: string | null;
        };
        Update: {
          titulo?: string;
          conteudo?: string;
          descricao_interna?: string | null;
          status?: TermoUsoStatus; // transições validadas por trigger
          exige_rolagem_completa?: boolean;
          exige_confirmacao_digitada?: boolean;
        };
        Relationships: [];
      };
      // Append-only: UPDATE/DELETE recusados por trigger. Campos de snapshot,
      // aceito_em, sequencia e hashes são preenchidos pelo banco (fora do Insert).
      termos_uso_aceite: {
        Row: {
          id: string;
          sequencia: number;
          termo_id: string;
          termo_identificador: string;
          termo_versao: number;
          termo_conteudo_hash: string;
          user_id: string;
          usuario_nome: string | null;
          usuario_email: string | null;
          usuario_cpf_cnpj: string | null;
          contexto_tipo: string;
          contexto_id: string | null;
          aceito_em: string;
          ip: string | null;
          ip_cadeia: string | null;
          user_agent: string | null;
          sessao_id: string | null;
          origem_url: string | null;
          dispositivo_tipo: DispositivoTipo | null;
          sistema_operacional: string | null;
          navegador: string | null;
          geo_ip_cidade: string | null;
          geo_ip_regiao: string | null;
          geo_ip_pais: string | null;
          geo_ip_latitude: number | null;
          geo_ip_longitude: number | null;
          tela_resolucao: string | null;
          idioma: string | null;
          fuso_horario: string | null;
          cliente_data_hora: string | null;
          geo_gps_status: GeoGpsStatus;
          geo_gps_latitude: number | null;
          geo_gps_longitude: number | null;
          geo_gps_precisao_m: number | null;
          confirmacao_tipo: ConfirmacaoTipo | null;
          confirmacao_valor: string | null;
          confirmacao_confere: boolean | null;
          termo_aberto_em: string | null;
          tempo_leitura_seg: number | null;
          rolou_ate_fim: boolean | null;
          hash_formato: number;
          hash_anterior: string | null;
          evidencia_hash: string;
        };
        Insert: {
          termo_id: string;
          user_id: string;
          contexto_tipo: string;
          contexto_id?: string | null;
          ip?: string | null;
          ip_cadeia?: string | null;
          user_agent?: string | null;
          sessao_id?: string | null;
          origem_url?: string | null;
          dispositivo_tipo?: DispositivoTipo | null;
          sistema_operacional?: string | null;
          navegador?: string | null;
          geo_ip_cidade?: string | null;
          geo_ip_regiao?: string | null;
          geo_ip_pais?: string | null;
          geo_ip_latitude?: number | null;
          geo_ip_longitude?: number | null;
          tela_resolucao?: string | null;
          idioma?: string | null;
          fuso_horario?: string | null;
          cliente_data_hora?: string | null;
          geo_gps_status?: GeoGpsStatus;
          geo_gps_latitude?: number | null;
          geo_gps_longitude?: number | null;
          geo_gps_precisao_m?: number | null;
          confirmacao_tipo?: ConfirmacaoTipo | null;
          confirmacao_valor?: string | null;
          confirmacao_confere?: boolean | null;
          termo_aberto_em?: string | null;
          tempo_leitura_seg?: number | null;
          rolou_ate_fim?: boolean | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_taxa_usuario: {
        Args: { p_user_id: string };
        Returns: number;
      };
      buscar_embarcacoes: {
        Args: {
          p_municipio_id?: number | null;
          p_lat?: number | null;
          p_lng?: number | null;
          p_raio_km?: number | null;
          p_data?: string | null;
          p_flex?: number | null;
          p_pessoas?: number | null;
          p_limit?: number | null;
          p_offset?: number | null;
          p_tipo_id?: string | null;
          p_preco_min?: number | null;
          p_preco_max?: number | null;
          p_duracao_min?: number | null;
          p_duracao_max?: number | null;
          p_ordenar?: string | null;
        };
        Returns: { id: string; distancia_km: number | null; total: number }[];
      };
      roteiros_top_avaliados: {
        Args: {
          p_lat?: number | null;
          p_lng?: number | null;
          p_raio_km?: number | null;
          p_limit?: number | null;
        };
        Returns: { id: string; media: number; total: number; score: number }[];
      };
      embarcacoes_top_avaliadas: {
        Args: {
          p_lat?: number | null;
          p_lng?: number | null;
          p_raio_km?: number | null;
          p_limit?: number | null;
        };
        Returns: { id: string; media: number; total: number; score: number }[];
      };
      buscar_roteiros: {
        Args: {
          p_municipio_id?: number | null;
          p_lat?: number | null;
          p_lng?: number | null;
          p_raio_km?: number | null;
          p_data?: string | null;
          p_flex?: number | null;
          p_pessoas?: number | null;
          p_limit?: number | null;
          p_offset?: number | null;
          p_tipo_id?: string | null;
          p_preco_min?: number | null;
          p_preco_max?: number | null;
          p_duracao_min?: number | null;
          p_duracao_max?: number | null;
          p_ordenar?: string | null;
        };
        Returns: { id: string; distancia_km: number | null; total: number }[];
      };
      chat_nao_lidas_por_cliente: {
        Args: { p_gestor?: string };
        Returns: { cliente_id: string; total: number }[];
      };
      chat_conversas_nao_lidas: {
        Args: { p_gestor?: string };
        Returns: {
          conversa_id: string;
          cliente_id: string;
          cliente_nome: string;
          cliente_avatar: string | null;
          total: number;
          ultima_mensagem: string;
          ultima_em: string;
        }[];
      };
      chat_total_nao_lidas: {
        Args: { p_gestor?: string };
        Returns: number;
      };
      chat_nao_lidas_por_gestor: {
        Args: { p_cliente?: string };
        Returns: { gestor_id: string; total: number }[];
      };
      chat_total_nao_lidas_cliente: {
        Args: { p_cliente?: string };
        Returns: number;
      };
      chat_conversas_cliente: {
        Args: { p_cliente?: string };
        Returns: {
          conversa_id: string;
          gestor_id: string;
          gestor_nome: string;
          gestor_avatar: string | null;
          ultima_mensagem: string;
          ultima_em: string;
          nao_lidas: number;
        }[];
      };
      chat_notificacoes_pendentes: {
        Args: Record<string, never>;
        Returns: {
          recipient_id: string;
          recipient_email: string;
          recipient_name: string;
          recipient_is_gestor: boolean;
          conversa_id: string;
          cliente_id: string;
          origem_tipo: string | null;
          origem_label: string | null;
          remetente_nome: string;
          qtd: number;
          primeira_em: string;
          ultima_em: string;
          msg_ids: string[];
        }[];
      };
      buscar_anuncios_venda: {
        Args: {
          p_tipo_id?: string | null;
          p_estado_id?: number | null;
          p_municipio_id?: number | null;
          p_ano_min?: number | null;
          p_ano_max?: number | null;
          p_preco_min?: number | null;
          p_preco_max?: number | null;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: { id: string; total: number }[];
      };
      registrar_visualizacao_anuncio: {
        Args: { p_anuncio: string };
        Returns: undefined;
      };
      registrar_tentativa_cupom: {
        Args: { p_cliente_id: string; p_sucesso: boolean };
        Returns: { bloqueado: boolean; bloqueado_ate: string | null }[];
      };
      registrar_uso_cupom: {
        Args: {
          p_cupom_id: string;
          p_cliente_id: string;
          p_reserva_id: string;
          p_valor_desconto: number;
        };
        Returns: boolean;
      };
      publicar_termo_uso: {
        Args: { p_termo_id: string; p_publicado_por: string | null };
        Returns: undefined;
      };
      verificar_cadeia_termos_aceite: {
        Args: Record<string, never>;
        Returns: { sequencia: number; aceite_id: string; problema: string }[];
      };
      vendas_locais: {
        Args: Record<string, never>;
        Returns: {
          estado_id: number;
          estado_nome: string;
          uf: string;
          municipio_id: number;
          municipio_nome: string;
          total: number;
        }[];
      };
      vendas_funil: {
        Args: { p_gestor?: string };
        Returns: {
          anuncio_id: string;
          embarcacao_nome: string;
          user_id: string;
          lead_nome: string;
          lead_avatar: string | null;
          eventos: string[];
          estagio: number;
          ultima_interacao: string;
        }[];
      };
    };
    Enums: {
      user_role: UserRole;
      embarcacao_status: EmbarcacaoStatus;
      preco_regra_tipo: PrecoRegraTipo;
      modalidade_capitao: ModalidadeCapitao;
      catalogo_tipo: CatalogoTipo;
      avaliacao_status: AvaliacaoStatus;
      anuncio_venda_status: AnuncioVendaStatus;
      anuncio_interacao_tipo: AnuncioInteracaoTipo;
      cupom_tipo_desconto: CupomTipoDesconto;
      termo_uso_status: TermoUsoStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

// ─── Atalhos de linha (Equipe) ───────────────────────────────────────────
export type EquipeMembroRow = Database['public']['Tables']['equipe_membro']['Row'];
export type EquipeMembroEmbarcacaoRow =
  Database['public']['Tables']['equipe_membro_embarcacao']['Row'];
export type ReservaAtendenteRow = Database['public']['Tables']['reserva_atendente']['Row'];
