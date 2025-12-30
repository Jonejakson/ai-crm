import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Политика конфиденциальности | Flame CRM',
  description: 'Политика конфиденциальности Flame CRM - защита персональных данных пользователей',
}

// Делаем страницу полностью статической
export const dynamic = 'force-static'
export const revalidate = false
export const runtime = 'nodejs'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 md:p-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Политика конфиденциальности
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            Последнее обновление: {new Date().toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <div className="prose prose-lg dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                1. Общие положения
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Настоящая Политика конфиденциальности (далее — «Политика») определяет порядок обработки и защиты персональных данных пользователей сервиса Flame CRM (далее — «Сервис»), расположенного по адресу в сети Интернет (далее — «Сайт»).
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Использование Сервиса означает безоговорочное согласие Пользователя с настоящей Политикой и указанными в ней условиями обработки его персональной информации.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                В случае несогласия с условиями Политики Пользователь должен прекратить использование Сервиса.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                2. Оператор персональных данных
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Оператором персональных данных является самозанятый Помазанова Елена Витальевна, ИНН 420207922975, предоставляющий услуги через Сервис Flame CRM.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Контактная информация для связи по вопросам обработки персональных данных:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4">
                <li>Email: info@flamecrm.ru</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                3. Категории обрабатываемых персональных данных
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Сервис обрабатывает следующие категории персональных данных:
              </p>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                3.1. Данные, предоставляемые при регистрации:
              </h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4">
                <li>Фамилия, имя, отчество</li>
                <li>Адрес электронной почты (email)</li>
                <li>Номер телефона</li>
                <li>Пароль (хранится в зашифрованном виде)</li>
              </ul>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                3.2. Данные юридического лица (при регистрации как юридическое лицо):
              </h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4">
                <li>Наименование организации</li>
                <li>ИНН (идентификационный номер налогоплательщика)</li>
                <li>КПП (код причины постановки на учет, при наличии)</li>
                <li>ОГРН (основной государственный регистрационный номер, при наличии)</li>
              </ul>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                3.3. Данные, собираемые автоматически:
              </h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4">
                <li>IP-адрес</li>
                <li>Информация о браузере и операционной системе</li>
                <li>Данные о посещенных страницах Сервиса</li>
                <li>Время и дата доступа к Сервису</li>
                <li>Cookies и аналогичные технологии</li>
              </ul>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                3.4. Данные, вводимые пользователем в процессе использования Сервиса:
              </h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4">
                <li>Информация о контактах (клиентах)</li>
                <li>Информация о сделках</li>
                <li>Задачи и события</li>
                <li>Комментарии и заметки</li>
                <li>Загруженные файлы</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                4. Цели обработки персональных данных
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Персональные данные обрабатываются в следующих целях:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4">
                <li>Предоставление доступа к функционалу Сервиса</li>
                <li>Идентификация Пользователя при входе в систему</li>
                <li>Обработка запросов и обращений Пользователя</li>
                <li>Обеспечение безопасности Сервиса и предотвращение мошенничества</li>
                <li>Обработка платежей и управление подписками</li>
                <li>Отправка уведомлений о важных событиях в Сервисе</li>
                <li>Улучшение качества Сервиса и разработка новых функций</li>
                <li>Соблюдение требований законодательства Российской Федерации</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                5. Правовые основания обработки персональных данных
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Обработка персональных данных осуществляется на основании:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4">
                <li>Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных»</li>
                <li>Согласия субъекта персональных данных на обработку его персональных данных</li>
                <li>Договора, стороной которого является субъект персональных данных</li>
                <li>Исполнения оператором возложенных на него законодательством обязанностей</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                6. Способы и сроки обработки персональных данных
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Обработка персональных данных осуществляется с использованием средств автоматизации и без использования таких средств.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Персональные данные обрабатываются в течение срока, необходимого для достижения целей обработки, или до момента отзыва согласия на обработку персональных данных Пользователем.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                После прекращения обработки персональных данных оператор уничтожает или обезличивает персональные данные в срок, не превышающий 30 дней с даты прекращения обработки, если иное не предусмотрено законодательством Российской Федерации.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                7. Меры по защите персональных данных
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Оператор принимает необходимые правовые, организационные и технические меры для защиты персональных данных от неправомерного доступа, уничтожения, изменения, блокирования, копирования, предоставления, распространения, а также от иных неправомерных действий:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4">
                <li>Использование современных методов шифрования данных</li>
                <li>Ограничение доступа к персональным данным только уполномоченным лицам</li>
                <li>Регулярное обновление систем безопасности</li>
                <li>Резервное копирование данных</li>
                <li>Мониторинг и логирование доступа к данным</li>
                <li>Использование защищенных протоколов передачи данных (HTTPS)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                8. Передача персональных данных третьим лицам
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Оператор не передает персональные данные третьим лицам, за исключением следующих случаев:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4">
                <li>Пользователь выразил согласие на такие действия</li>
                <li>Передача предусмотрена законодательством Российской Федерации</li>
                <li>Передача необходима для работы Сервиса (например, платежным системам для обработки платежей)</li>
                <li>Передача происходит в рамках слияния, приобретения или продажи активов</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                При передаче персональных данных третьим лицам оператор обеспечивает соблюдение требований законодательства о защите персональных данных.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                9. Права субъекта персональных данных
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Пользователь имеет право:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4">
                <li>Получать информацию, касающуюся обработки его персональных данных</li>
                <li>Требовать уточнения персональных данных, их блокирования или уничтожения</li>
                <li>Отозвать согласие на обработку персональных данных</li>
                <li>Обжаловать действия или бездействие оператора в уполномоченный орган по защите прав субъектов персональных данных или в судебном порядке</li>
                <li>Получить информацию о сроках хранения персональных данных</li>
                <li>Получить информацию о реализуемых требованиях к защите персональных данных</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Для реализации указанных прав Пользователь может направить запрос оператору по контактным данным, указанным в разделе 2 настоящей Политики.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                10. Cookies и аналогичные технологии
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Сервис использует cookies и аналогичные технологии для обеспечения функциональности Сервиса, улучшения пользовательского опыта и анализа использования Сервиса.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Пользователь может настроить свой браузер для отказа от cookies, однако это может повлиять на функциональность Сервиса.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                11. Изменения в Политике конфиденциальности
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Оператор имеет право вносить изменения в настоящую Политику конфиденциальности. Новая редакция Политики вступает в силу с момента ее размещения на Сайте, если иное не предусмотрено новой редакцией Политики.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Пользователь обязуется самостоятельно следить за изменениями в Политике конфиденциальности, знакомясь с актуальной редакцией при каждом посещении Сайта.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                12. Контактная информация
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                По всем вопросам, связанным с обработкой персональных данных, Пользователь может обратиться к оператору:
              </p>
              <ul className="list-none text-gray-700 dark:text-gray-300 mb-4">
                <li className="mb-2"><strong>ФИО:</strong> Помазанова Елена Витальевна</li>
                <li className="mb-2"><strong>ИНН:</strong> 420207922975</li>
                <li className="mb-2"><strong>Email:</strong> info@flamecrm.ru</li>
                <li className="mb-2">Через форму обратной связи в Сервисе</li>
              </ul>
            </section>

            <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                Настоящая Политика конфиденциальности разработана в соответствии с требованиями Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных».
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

