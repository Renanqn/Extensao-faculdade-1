import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { filterAgendamentos } from '../../store/modules/agendamento/actions';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import moment from 'moment';
import 'moment/locale/pt-br';
import util from '../../util';

moment.locale('pt-br');

const localizer = momentLocalizer(moment);

const messages = {
  today: 'Hoje',
  previous: 'Anterior',
  next: 'Próximo',
  month: 'Mês',
  week: 'Semana',
  day: 'Dia',
  agenda: 'Agenda',
  date: 'Data',
  time: 'Hora',
  event: 'Evento',
  showMore: (count) => `+ Ver mais (${count})`,
};

const Agendamentos = () => {
  const dispatch = useDispatch();
  // Garantir que agendamentos sempre seja um array, mesmo quando o estado estiver vazio ou undefined
  const { agendamentos = [] } = useSelector((state) => state.agendamento);

  // Função para formatar eventos para o calendário
  const formatEventos = () => {
    if (!agendamentos || agendamentos.length === 0) {
      return []; // Retorna um array vazio caso não haja agendamentos
    }

    const listaEventos = agendamentos.map((agendamento) => ({
      resource: { agendamento },
      title: `${agendamento.servicoId.titulo} - ${agendamento.clienteId.nome} - ${agendamento.colaboradorId.nome}`,
      start: moment(agendamento.data).toDate(),
      end: moment(agendamento.data)
        .add(
          util.hourToMinutes(
            moment(agendamento.servicoId.duracao).format('HH:mm')
          ),
          'minutes'
        )
        .toDate(),
    }));

    return listaEventos;
  };

  useEffect(() => {
    dispatch(
      filterAgendamentos({
        start: moment().weekday(0).format('YYYY-MM-DD'),
        end: moment().weekday(6).format('YYYY-MM-DD'),
      })
    );
  }, [dispatch]);

  // Função para formatar o range de datas do calendário
  const formatRange = (range) => {
    let finalRange = {};
    if (Array.isArray(range)) {
      finalRange = {
        start: moment(range[0]).format('YYYY-MM-DD'),
        end: moment(range[range.length - 1]).format('YYYY-MM-DD'),
      };
    } else {
      finalRange = {
        start: moment(range.start).format('YYYY-MM-DD'),
        end: moment(range.end).format('YYYY-MM-DD'),
      };
    }

    return finalRange;
  };

  // Função para manipular navegação (onNavigate)
  const handleNavigate = (date, view) => {
    console.log('Navegando para:', date);
    console.log('Visão atual:', view);
    // Aqui você pode implementar qualquer lógica que precise quando o usuário navegar
  };

  return (
    <div className="col p-5 overflow-auto h-100">
      <div className="row">
        <div className="col-12">
          <h2 className="mb-4 mt-0">Agendamentos</h2>
          <Calendar
            localizer={localizer}
            onRangeChange={(range) =>
              dispatch(filterAgendamentos(formatRange(range)))
            }
            onSelectEvent={() => {}}
            events={formatEventos()} // Chama a função que já verifica se agendamentos é válido
            defaultView="week"
            selectable={true}
            popup={true}
            messages={messages}
            style={{ height: 600 }}
            onNavigate={handleNavigate} // Adicionando o onNavigate
          />
        </div>
      </div>
    </div>
  );
};

export default Agendamentos;
