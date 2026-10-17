import { en } from '../../i18n/en';
import { paths } from '../../router';

interface Props {
  message: string;
}

export function NotFound({ message }: Props) {
  return (
    <main className="page page-text">
      <div className="empty">
        <h2>{en.notFound.title}</h2>
        <p>{message}</p>
        <a className="btn btn-primary btn-md" href={paths.home()}>
          {en.common.home}
        </a>
      </div>
    </main>
  );
}
