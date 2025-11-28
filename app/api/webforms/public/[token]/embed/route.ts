import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { sanitizeFormFields } from "@/lib/webforms"

type RouteContext = { params: Promise<{ token: string }> }

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { token } = await context.params
    const form = await prisma.webForm.findUnique({
      where: { token },
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
      displayType: (form.displayType === "popup" ? "popup" : "inline") as "inline" | "popup",
      buttonText: form.buttonText || "Оставить заявку",
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
  displayType: "inline" | "popup"
  buttonText: string
}) {
  const serializedConfig = JSON.stringify(config)
  const isPopup = config.displayType === "popup"
  
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

  function createForm() {
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

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.textContent = CONFIG.submitText || 'Отправить';
    submitBtn.style.padding = '12px 16px';
    submitBtn.style.borderRadius = '999px';
    submitBtn.style.border = 'none';
    submitBtn.style.background = 'linear-gradient(90deg, #10b981, #0ea5e9)';
    submitBtn.style.color = '#fff';
    submitBtn.style.fontWeight = '600';
    submitBtn.style.cursor = 'pointer';
    form.appendChild(submitBtn);

    const messageEl = document.createElement('div');
    messageEl.style.fontSize = '14px';
    messageEl.style.color = '#059669';
    messageEl.style.marginTop = '4px';

    form.addEventListener('submit', async function(event){
      event.preventDefault();
      messageEl.textContent = '';
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.7';
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
          } else if (${isPopup ? 'true' : 'false'}) {
            setTimeout(function() {
              closeModal();
            }, 2000);
          }
        } else {
          messageEl.textContent = (data && data.error) ? data.error : 'Не удалось отправить форму';
          messageEl.style.color = '#b91c1c';
        }
      } catch (error) {
        messageEl.textContent = 'Ошибка соединения';
        messageEl.style.color = '#b91c1c';
      } finally {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
      }
    });

    return { form: form, messageEl: messageEl };
  }

  ${isPopup ? `
  function openModal() {
    if (document.getElementById('pocketcrm-modal-' + CONFIG.token)) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'pocketcrm-modal-' + CONFIG.token;
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '999999';
    overlay.style.padding = '20px';
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal();
    });

    const modal = document.createElement('div');
    modal.style.backgroundColor = '#fff';
    modal.style.borderRadius = '16px';
    modal.style.padding = '24px';
    modal.style.maxWidth = '500px';
    modal.style.width = '100%';
    modal.style.maxHeight = '90vh';
    modal.style.overflowY = 'auto';
    modal.style.position = 'relative';
    modal.addEventListener('click', function(e) { e.stopPropagation(); });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '12px';
    closeBtn.style.right = '12px';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.fontSize = '24px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.color = '#6b7280';
    closeBtn.style.width = '32px';
    closeBtn.style.height = '32px';
    closeBtn.style.display = 'flex';
    closeBtn.style.alignItems = 'center';
    closeBtn.style.justifyContent = 'center';
    closeBtn.addEventListener('click', closeModal);
    modal.appendChild(closeBtn);

    const formContainer = document.createElement('div');
    const formData = createForm();
    formContainer.appendChild(formData.form);
    formContainer.appendChild(formData.messageEl);
    modal.appendChild(formContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  function closeModal() {
    const overlay = document.getElementById('pocketcrm-modal-' + CONFIG.token);
    if (overlay) overlay.remove();
  }

  const triggerBtn = document.createElement('button');
  triggerBtn.textContent = CONFIG.buttonText || 'Оставить заявку';
  triggerBtn.type = 'button';
  triggerBtn.style.padding = '12px 24px';
  triggerBtn.style.borderRadius = '999px';
  triggerBtn.style.border = 'none';
  triggerBtn.style.background = 'linear-gradient(90deg, #10b981, #0ea5e9)';
  triggerBtn.style.color = '#fff';
  triggerBtn.style.fontWeight = '600';
  triggerBtn.style.cursor = 'pointer';
  triggerBtn.style.fontSize = '16px';
  triggerBtn.addEventListener('click', openModal);
  target.appendChild(triggerBtn);
  ` : `
  const formData = createForm();
  target.appendChild(formData.form);
  target.appendChild(formData.messageEl);
  `}
})();`
}

