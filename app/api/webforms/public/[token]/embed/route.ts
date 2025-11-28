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

  // Читаем кастомные цвета из data-атрибутов контейнера
  function getColor(attr, defaultColor) {
    return target.getAttribute('data-' + attr) || defaultColor;
  }
  const colors = {
    primary: getColor('primary-color', '#10b981'),
    secondary: getColor('secondary-color', '#0ea5e9'),
    overlay: getColor('overlay-color', 'rgba(0, 0, 0, 0.5)'),
    text: getColor('text-color', '#111827'),
    border: getColor('border-color', '#d1d5db'),
    success: getColor('success-color', '#059669'),
    error: getColor('error-color', '#b91c1c'),
    bg: getColor('bg-color', '#ffffff'),
  };

  function createForm() {
    const form = document.createElement('form');
    form.className = 'pocketcrm-form';
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = '20px';
    form.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    form.style.width = '100%';

    CONFIG.fields.forEach(function(field){
      const wrapper = document.createElement('label');
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.fontSize = '15px';
      wrapper.style.color = colors.text;
      wrapper.style.fontWeight = '500';
      wrapper.style.marginBottom = '0';
      wrapper.textContent = field.label + (field.required ? ' *' : '');

      var input;
      if (field.key === 'message') {
        input = document.createElement('textarea');
        input.style.minHeight = '200px';
        input.style.resize = 'vertical';
      } else {
        input = document.createElement('input');
        input.type = field.key === 'email' ? 'email' : field.key === 'phone' ? 'tel' : 'text';
      }
      input.name = field.key;
      input.placeholder = field.placeholder || '';
      input.required = !!field.required;
      input.style.marginTop = '8px';
      input.style.padding = '14px 16px';
      input.style.borderRadius = '12px';
      input.style.border = '1px solid ' + colors.border;
      input.style.fontSize = '15px';
      input.style.width = '100%';
      input.style.boxSizing = 'border-box';
      input.style.transition = 'border-color 0.2s, box-shadow 0.2s';
      input.style.outline = 'none';
      input.addEventListener('focus', function(){ 
        input.style.borderColor = colors.primary;
        input.style.boxShadow = '0 0 0 3px ' + colors.primary + '20';
      });
      input.addEventListener('blur', function(){ 
        input.style.borderColor = colors.border;
        input.style.boxShadow = 'none';
      });
      wrapper.appendChild(input);
      form.appendChild(wrapper);
    });

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.textContent = CONFIG.submitText || 'Отправить';
    submitBtn.style.padding = '14px 24px';
    submitBtn.style.borderRadius = '12px';
    submitBtn.style.border = 'none';
    submitBtn.style.background = 'linear-gradient(90deg, ' + colors.primary + ', ' + colors.secondary + ')';
    submitBtn.style.color = '#fff';
    submitBtn.style.fontWeight = '600';
    submitBtn.style.fontSize = '16px';
    submitBtn.style.cursor = 'pointer';
    submitBtn.style.width = '100%';
    submitBtn.style.transition = 'opacity 0.2s, transform 0.2s';
    submitBtn.addEventListener('mouseenter', function() { submitBtn.style.transform = 'translateY(-1px)'; });
    submitBtn.addEventListener('mouseleave', function() { submitBtn.style.transform = 'translateY(0)'; });
    form.appendChild(submitBtn);

    const messageEl = document.createElement('div');
    messageEl.style.fontSize = '14px';
    messageEl.style.color = colors.success;
    messageEl.style.marginTop = '8px';
    messageEl.style.textAlign = 'center';

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
          messageEl.style.color = colors.success;
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
          messageEl.style.color = colors.error;
        }
      } catch (error) {
        messageEl.textContent = 'Ошибка соединения';
        messageEl.style.color = colors.error;
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
    overlay.style.backgroundColor = colors.overlay;
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '999999';
    overlay.style.padding = '20px';
    overlay.style.backdropFilter = 'blur(4px)';
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal();
    });

    const modal = document.createElement('div');
    modal.style.backgroundColor = colors.bg;
    modal.style.borderRadius = '20px';
    modal.style.padding = '32px';
    modal.style.maxWidth = '600px';
    modal.style.width = '100%';
    modal.style.maxHeight = '90vh';
    modal.style.overflowY = 'auto';
    modal.style.position = 'relative';
    modal.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
    modal.addEventListener('click', function(e) { e.stopPropagation(); });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '16px';
    closeBtn.style.right = '16px';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.fontSize = '28px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.color = '#6b7280';
    closeBtn.style.width = '36px';
    closeBtn.style.height = '36px';
    closeBtn.style.display = 'flex';
    closeBtn.style.alignItems = 'center';
    closeBtn.style.justifyContent = 'center';
    closeBtn.style.borderRadius = '8px';
    closeBtn.style.transition = 'background-color 0.2s';
    closeBtn.addEventListener('mouseenter', function() { closeBtn.style.backgroundColor = '#f3f4f6'; });
    closeBtn.addEventListener('mouseleave', function() { closeBtn.style.backgroundColor = 'transparent'; });
    closeBtn.addEventListener('click', closeModal);
    modal.appendChild(closeBtn);

    const formContainer = document.createElement('div');
    formContainer.style.width = '100%';
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
  triggerBtn.style.padding = '14px 28px';
  triggerBtn.style.borderRadius = '12px';
  triggerBtn.style.border = 'none';
  triggerBtn.style.background = 'linear-gradient(90deg, ' + colors.primary + ', ' + colors.secondary + ')';
  triggerBtn.style.color = '#fff';
  triggerBtn.style.fontWeight = '600';
  triggerBtn.style.cursor = 'pointer';
  triggerBtn.style.fontSize = '16px';
  triggerBtn.style.transition = 'opacity 0.2s, transform 0.2s';
  triggerBtn.addEventListener('mouseenter', function() { 
    triggerBtn.style.opacity = '0.9';
    triggerBtn.style.transform = 'translateY(-2px)';
  });
  triggerBtn.addEventListener('mouseleave', function() { 
    triggerBtn.style.opacity = '1';
    triggerBtn.style.transform = 'translateY(0)';
  });
  triggerBtn.addEventListener('click', openModal);
  target.appendChild(triggerBtn);
  ` : `
  const formData = createForm();
  target.appendChild(formData.form);
  target.appendChild(formData.messageEl);
  `}
})();`
}

