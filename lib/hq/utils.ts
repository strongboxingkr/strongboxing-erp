export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

export function formatPhone(phone: string) {
  return phone.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
}

export function cls(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}
