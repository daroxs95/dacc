import styles from './Navbar.module.css';

export function Navbar() {
    return (
        <nav className={`${styles.nav} noPrint`}>
            <div className={`${styles.navContent} w-100 m-auto f-jc-between`}>
                <h2>
                    DInvoicing
                </h2>
            </div>
        </nav>
    );
}