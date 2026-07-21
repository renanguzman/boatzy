export type UserRole = 'admin' | 'gestor' | 'cliente';
export type EmbarcacaoStatus = 'ativo' | 'inativo' | 'em_manutencao';
export type PrecoRegraTipo = 'dia_semana' | 'periodo_anual' | 'data_fixa';
export type ModalidadeCapitao = 'sem_capitao' | 'com_capitao' | 'opcional';
export type CatalogoTipo = 'produto' | 'servico';
export type ReservaStatus = 'pendente' | 'confirmada' | 'recusada' | 'cancelada' | 'concluida';
export type ReservaTipo = 'roteiro' | 'embarcacao';
export type AvaliacaoStatus = 'pendente' | 'aprovada';
export type AnuncioVendaStatus = 'ativo' | 'pausado' | 'vendido' | 'cancelado';
export type AnuncioInteracaoTipo =
  | 'visualizou'
  | 'revelou_contato'
  | 'favoritou'
  | 'compartilhou'
  | 'conversou';

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
          total_adicionais: number;
          taxa_servico: number | null;
          total_estimado: number | null;
          status: ReservaStatus;
          observacao_gestor: string | null;
          solicitado_em: string;
          respondido_em: string | null;
          cancelada_em: string | null;
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
          total_adicionais?: number;
          taxa_servico?: number | null;
          total_estimado?: number | null;
          status?: ReservaStatus;
          observacao_gestor?: string | null;
          solicitado_em?: string;
          respondido_em?: string | null;
          cancelada_em?: string | null;
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
          total_adicionais?: number;
          taxa_servico?: number | null;
          total_estimado?: number | null;
          status?: ReservaStatus;
          observacao_gestor?: string | null;
          solicitado_em?: string;
          respondido_em?: string | null;
          cancelada_em?: string | null;
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
      embarcacao_categoria: {
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
          cabines: number | null;
          quartos: number | null;
          suites: number | null;
          banheiros: number | null;
          tripulacao: number | null;
          embarcacao_tipo_id: string | null;
          embarcacao_categoria_id: string | null;
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
          cabines?: number | null;
          quartos?: number | null;
          suites?: number | null;
          banheiros?: number | null;
          tripulacao?: number | null;
          embarcacao_tipo_id?: string | null;
          embarcacao_categoria_id?: string | null;
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
          cabines?: number | null;
          quartos?: number | null;
          suites?: number | null;
          banheiros?: number | null;
          tripulacao?: number | null;
          embarcacao_tipo_id?: string | null;
          embarcacao_categoria_id?: string | null;
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
          data_criacao: string;
        };
        Insert: {
          id?: string;
          embarcacao_id: string;
          url_imagem: string;
          titulo?: string | null;
          principal?: boolean;
          data_criacao?: string;
        };
        Update: {
          id?: string;
          embarcacao_id?: string;
          url_imagem?: string;
          titulo?: string | null;
          principal?: boolean;
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
          data_criacao: string;
        };
        Insert: {
          id?: string;
          roteiro_id: string;
          url_imagem: string;
          titulo?: string | null;
          principal?: boolean;
          data_criacao?: string;
        };
        Update: {
          id?: string;
          roteiro_id?: string;
          url_imagem?: string;
          titulo?: string | null;
          principal?: boolean;
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
    };
    Views: Record<string, never>;
    Functions: {
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
    };
    CompositeTypes: Record<string, never>;
  };
};
