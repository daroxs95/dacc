import {useLang} from "~/hooks/useLang";
import styles from './Navbar.module.css';

export function Navbar({onOpenConfig}: {onOpenConfig: () => void}) {
    const {t} = useLang();
    return (
        <nav className={`${styles.nav} noPrint`}>
            <div className={`${styles.navContent} w-100 m-auto f-jc-between`}>
                <h2>
                    DInvoicing
                </h2>
                <button className="muted compact" type="button" onClick={onOpenConfig} aria-haspopup="dialog">
                    {t("Settings")}
                </button>
            </div>
        </nav>
    );
}
