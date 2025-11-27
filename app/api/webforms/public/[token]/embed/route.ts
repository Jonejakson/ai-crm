import prisma from "@/lib/prisma"
import { sanitizeFormFields } from "@/lib/webforms"

export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const form = await prisma.webForm.findUnique({
      where: { token: params.token },
    })

    if (!form || !form.isActive) {
      return new Response("console.error('Форма не найдена');", {
        headers: { "Content-Type": "application/javascript", "Cache-Control": "no-store" },
        status: 404,
      })
    }

    const origin = new URL(request.url).origin
    const config = sanitizeFormFields(form.fields)
    const script = buildEmbedScript({
      token: form.token,
      endpoint: `${origin}/api/webforms/public/${form.token}/submit`,
      fields: config.fields.filter((field) => field.enabled !== false),
      submitText: config.submitButtonLabel || "Отправить",
      successMessage: form.successMessage || "Спасибо! Мы свяжемся с вами в ближайшее время.",
    })

    return new Response(script, {
      headers: {
        "Content-Type": "application/javascript",
        "Cache-Control": "max-age=300, s-maxage=300",
      },
    })
  } catch (error) {
    console.error("[webforms][embed]", error)
    return new Response("console.error('Не удалось загрузить форму');", {
      headers: { "Content-Type": "application/javascript" },
      status: 500,
    })
  }
}

function buildEmbedScript(config: {
  token: string
  endpoint: string
  fields: Array<{ key: string; label: string; required: boolean; placeholder?: string }>
  submitText: string
  successMessage: string
}) {
  const serializedConfig = JSON.stringify(config)
  return `
(function(){
  const CONFIG = ${serializedConfig};
  const script = document.currentScript;
  const target = document.querySelector('[data-webform-token="' + CONFIG.token + '"]') || script.parentElement;
  if (!target) {
    console.error('PocketCRM: контейнер с атрибутом data-webform-token="' + CONFIG.token + '" не найден');
    return;
  }
  target.innerHTML = '';
  const form = document.createElement('form');
  form.className = 'pocketcrm-form';
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '12px';
  form.style.fontFamily = 'Arial, sans-serif';

  CONFIG.fields.forEach(function(field){
    const wrapper = document.createElement('label');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.fontSize = '14px';
    wrapper.style.color = '#111827';
    wrapper.textContent = field.label + (field.required ? ' *' : '');

    var input;
    if (field.key === 'message') {
      input = document.createElement('textarea');
      input.rows = 4;
    } else {
      input = document.createElement('input');
      input.type = field.key === 'email' ? 'email' : field.key === 'phone' ? 'tel' : 'text';
    }
    input.name = field.key;
    input.placeholder = field.placeholder || '';
    input.required = !!field.required;
    input.style.marginTop = '4px';
    input.style.padding = '10px 12px';
    input.style.borderRadius = '10px';
    input.style.border = '1px solid #d1d5db';
    input.style.fontSize = '14px';
    input.style.transition = 'border-color 0.2s';
    input.addEventListener('focus', function(){ input.style.borderColor = '#10b981'; });
    input.addEventListener('blur', function(){ input.style.borderColor = '#d1d5db'; });
    wrapper.appendChild(input);
    form.appendChild(wrapper);
  });

  const button = document.createElement('button');
  button.type = 'submit';
  button.textContent = CONFIG.submitText || 'Отправить';
  button.style.padding = '12px 16px';
  button.style.borderRadius = '999px';
  button.style.border = 'none';
  button.style.background = 'linear-gradient(90deg, #10b981, #0ea5e9)';
  button.style.color = '#fff';
  button.style.fontWeight = '600';
  button.style.cursor = 'pointer';
  form.appendChild(button);

  const messageEl = document.createElement('div');
  messageEl.style.fontSize = '14px';
  messageEl.style.color = '#059669';
  messageEl.style.marginTop = '4px';

  form.addEventListener('submit', async function(event){
    event.preventDefault();
    messageEl.textContent = '';
    button.disabled = true;
    button.style.opacity = '0.7';
    const formData = new FormData(form);
    formData.append('_origin', window.location.href);
    try {
      const response = await fetch(CONFIG.endpoint, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok && data.success) {
        messageEl.textContent = data.message || CONFIG.successMessage;
        messageEl.style.color = '#059669';
        form.reset();
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        }
      } else {
        messageEl.textContent = (data && data.error) ? data.error : 'Не удалось отправить форму';
        messageEl.style.color = '#b91c1c';
      }
    } catch (error) {
      messageEl.textContent = 'Ошибка соединения';
      messageEl.style.color = '#b91c1c';
    } finally {
      button.disabled = false;
      button.style.opacity = '1';
    }
  });

  target.appendChild(form);
  target.appendChild(messageEl);
})();`
}

